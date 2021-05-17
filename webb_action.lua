--[==[

	webb | action-based routing with multi-language support
	Written by Cosmin Apreutesei. Public Domain.

ACTION ALIASES

	lang([s]) -> s                        get/set current language
	alias(name_en, name, lang)            set an action alias for a language
	find_action(name, ...) -> name, ...   find action and set language
	setlinks(s) -> s                      translate URLs based on aliases

ACTIONS

	action(name, args...) -> t|f          execute action (false if not found)
	exec(name, args...) -> ret...|true    execute action internally

	function action.NAME(args...) end     set an inline action handler

CONFIG

	config('lang', 'en')                  default language
	config('root_action', 'en')           name of the '/' (root) action
	config('404_html_action', '404.html') 404 action for text/html
	config('404_png_action', '404.png')   404 action for image/png
	config('404_jpeg_action', '404.jpg')  404 action for image/jpeg

	action['404.html']                    basic `404 Not Found` text

TODO

	* cascaded actions: html.m.lua, html.m.lp, etc.
	* .markdown filter.

]==]

require'webb'

--action aliases -------------------------------------------------------------

function lang(s)
	if s then
		req_ctx.lang = s
	else
		return req_ctx.lang or args'lang' or config('lang', 'en')
	end
end

--NOTE: it is assumed that action names are always in english even if they
--actually request a page in the default language which can configured
--to be different than english. Action name translation is done
--automatically provided that 1) all links are passed through lang_url(),
--2) routing is done by calling action(find_action(unpack(args()))) instead
--of action(unpack(args())), and 3) action names are translated in different
--languages with alias(). Using action aliases is the key to avoiding
--the appending of ?lang=xx to links. Aliases for the root action ('en')
--are also allowed in order to avoid the ?lang param.

local aliases = {} --{alias={lang=, action=}}
local aliases_json = {to_en = {}, to_lang = {}}
config('aliases', aliases_json) --we pass those to the client

local function action_name(action)
	return action:gsub('-', '_')
end

local function action_urlname(action)
	return action:gsub('_', '-')
end

function alias(en_action, alias_action, alias_lang)
	local default_lang = config('lang', 'en')
	alias_lang = alias_lang or default_lang
	alias_action = action_name(alias_action)
	en_action = action_name(en_action)
	aliases[alias_action] = {lang = alias_lang, action = en_action}
	--if the default language is not english and we're making
	--an alias for the default language, then we can safely assign
	--the english action name for the english language, whereas before
	--we would use the english action name for the default language.
	if default_lang ~= 'en' and alias_lang == default_lang then
		if not aliases[en_action] then --user can override this
			aliases[en_action] = {lang = 'en', action = en_action}
			glue.attr(aliases_json.to_lang, en_action).en = en_action
		end
	end
	aliases_json.to_en[alias_action] = en_action
	glue.attr(aliases_json.to_lang, en_action)[alias_lang] = alias_action
end

local function decode_url(s)
	return type(s) == 'string' and url(s) or s
end

local function url_action(s)
	local t = decode_url(s)
	return t[1] == '' and t[2] and action_name(t[2]) or nil
end

--given an url (in encoded or decoded form), if it's an action url,
--replace its action name with a language-specific alias for a given
--(or current) language if any, or add ?lang= if the given language
--is not the default language.
function lang_url(s, target_lang)
	local t = decode_url(s)
	local default_lang = config('lang', 'en')
	local target_lang = target_lang or t.lang or lang()
	local action = url_action(t)
	if not action then
		return s
	end
	local is_root = t[2] == ''
	if is_root then
		action = action_name(config('root_action', 'en'))
	end
	local at = aliases_json.to_lang[action]
	local lang_action = at and at[target_lang]
	if lang_action then
		if not (is_root and target_lang == default_lang) then
			t[2] = lang_action
		end
	elseif target_lang ~= default_lang then
		t.lang = target_lang
	end
	t[2] = action_urlname(t[2])
	return url(t)
end

--given a list of path elements, find the action they point to
--and change the current language if necessary.
function find_action(action, ...)
	if action == '' then --root action in current language
		action = config('root_action', 'en')
	else
		local alias = aliases[action_name(action)] --look for a regional alias
		if alias then
			if not args'lang' then --?lang= has priority
				lang(alias.lang)
			end
			action = alias.action
		end
	end
	return action, ...
end

--html output filter for rewriting links based on current language aliases
function setlinks(s)
	local function repl(prefix, s)
		return prefix..lang_url(s)
	end
	s = s:gsub('(%shref=")([^"]+)', repl)
	s = s:gsub('(%shref=)([^ >]+)', repl)
	return s
end

--override redirect to automatically translate URLs.
local webb_redirect = redirect
function redirect(url, ...)
	if lang_url then
		url = lang_url(url)
	end
	return webb_redirect(url, ...)
end

--serving plain files --------------------------------------------------------

local ffi = require'ffi'
local fs = require'fs'

local function plain_file_handler(file)

	if wwwfile[file] then
		return wwwfile(file)
	end

	local path = wwwpath(file)
	if not path then
		return
	end
	local f = assert(fs.open(path, 'r'))

	local mtime, err = f:attr'mtime'
	if not mtime then
		f:close()
		error(err)
	end
	setheader('last-modified', mtime)

	local file_size, err = f:attr'size'
	if not file_size then
		f:close()
		error(err)
	end
	setheader('content-length', file_size)

	return function()
		local filebuf_size = math.min(file_size, 65536)
		local filebuf = ffi.new('char[?]', filebuf_size)
		while true do
			local len, err = f:read(filebuf, filebuf_size)
			if not len then
				f:close()
				error(err)
			elseif len == 0 then
				f:close()
				break
			else
				outbuf(filebuf, len)
			end
		end
	end
end

--output filters -------------------------------------------------------------

local function html_filter(handler, action, ...)
	local s = record(handler, action, ...)
	local s = setlinks(filter_lang(filter_comments(s), lang()))
	check_etag(s)
	setcontent(s)
end

local function json_filter(handler, action, ...)
	local s = handler(action, ...)
	if type(s) == 'table' then
		s = json(s)
	end
	if s then
		check_etag(s)
		setcontent(s)
	end
end

local mime_type_filters = {
	['text/html']        = html_filter,
	['application/json'] = json_filter,
}

--routing logic --------------------------------------------------------------

local file_handlers = {
	cat = function(file, ...)
		catlist(file, ...)
	end,
	lua = function(file, ...)
		return run(file, nil, ...)
	end,
	lp = function(file, ...)
		include(file)
	end,
}

local actions_ext = glue.keys(file_handlers, true)

local function file_action(...)
	local file = table.concat({...}, '/')
	local ext = file:match'%.([^%.]+)$'
	local plain_file_allowed = not (ext and file_handlers[ext])
	if plain_file_allowed then
		local handler = plain_file_handler(file)
		if handler then
			return handler
		end
	end
	local action_file, handler
	for i,ext in ipairs(actions_ext) do
		local action_file1 = file..'.'..ext
		if wwwfile[action_file1] or wwwpath(action_file1) then
			glue.assert(not action_file,
				'multiple action files for %s (%s, was %s)',
					file, action_file1, action_file)
			handler = file_handlers[ext]
			action_file = action_file1
		end
	end
	return action_file and function(...)
		return handler(action_file, ...)
	end
end

local actions = {} --{action -> handler | s}

local function action_handler(action, ...)
	local ext = action:match'%.([^%.]+)$'
	local action_no_ext
	local action_with_ext = action
	if not ext then --add the default .html extension to the action
		action_no_ext = action
		ext = 'html'
		action_with_ext = action .. '.' .. ext
	elseif ext == 'html' then
		action_no_ext = action:gsub('%.html$', '')
	end

	local handler =
		(action_no_ext and actions[action_name(action_no_ext)]) --look in the default action table
		or actions[action_name(action_with_ext)] --look again with .html extension
		or file_action(action, ...) --look in the filesystem

	if handler and type(handler) ~= 'function' then
		local s = handler
		handler = function()
			setcontent(s)
		end
	end
	return handler, action_no_ext, action_with_ext, ext
end

--exec an action without setting content type, looking for a 404 handler
--or filtering the output based on mime type, instead returns whatever
--the action returns (good for exec'ing json actions which return a table).
local function pass(arg1, ...)
	if not arg1 then
		return true, ...
	else
		return arg1, ...
	end
end
function exec(action, ...)
	local handler = action_handler(action, ...)
	if not handler then return false end
	return pass(handler(...))
end

local function action_call(actions, action, ...)
	local handler, action_no_ext, action_with_ext, ext =
		action_handler(action, ...)
	if not handler then
		local not_found_actions = {
			['text/html' ] = config('404_html_action', '404.html'),
			['image/png' ] = config('404_png_action' , '404.png'),
			['image/jpeg'] = config('404_jpeg_action', '404.jpg'),
		}
		local mime = mime_types[ext]
		local nf_action = not_found_actions[mime]
		log('NOT FOUND', '%s', table.concat({action, ...}, '/'))
		if not nf_action
			or nf_action == action --loop
			or nf_action == action_with_ext --loop
			or nf_action == action_no_ext --loop
		then
			return false
		end
		return action_call(actions, nf_action, action, ...)
	end
	setmime(ext)
	local filter = mime_type_filters[mime]
	if filter then
		filter(handler, ...)
	else
		handler(...)
	end
	return true
end

action = actions
setmetatable(action, {__call = action_call})
