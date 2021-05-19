--[==[

	webb | main module
	Written by Cosmin Apreutesei. Public Domain.

Exports

	glue

CONFIG

	config'base_url'                        optional, for absurl()

CONFIG API

	config(name[, default_val]) -> val      get/set config value
	config{name->val}                       set multiple config values
	S(name[, default_val])                  get/set internationalized string

ENVIRONMENT

	once(f[, clear_cache[, k]])             memoize for current request
	env([t]) -> t                           per-request shared environment

LOGGING

	log(...)

REQUEST

	headers([name]) -> s|t                  get header or all
	method([method]) -> s|b                 get/check http method
	post([name]) -> s | t | nil             get POST arg or all
	args([n|name]) -> s | t | nil           get path element or GET arg or all
	scheme([s]) -> s | t|f                  get/check request scheme
	host([s]) -> s | t|f                    get/check request host
	port([p]) -> p | t|f                    get/check server port
	email(user) -> s                        get email address of user
	client_ip() -> s                        get client's ip address

ARG PARSING

	id_arg(s) -> n | nil                    validate int arg with slug
	str_arg(s) -> s | nil                   validate/trim non-empty string arg
	enum_arg(s, values...) -> s | nil       validate enum arg
	list_arg(s[, arg_f]) -> t               validate comma-separated list arg
	checkbox_arg(s) -> 'checked' | nil      validate checkbox value from html form

OUTPUT

	setcontent(s)                           output a single value
	out(s1,...)                             output one or more values
	push_out([f])                           push output function or buffer
	pop_out() -> s                          pop output function and flush it
	stringbuffer([t]) -> f(s1,...)/f()->s   create a string buffer
	record(f) -> s                          run f and collect out() calls
	out_buffering() -> t | f                check if we're buffering output
	setheader(name, val)                    set a header (unless we're buffering)
	setmime(ext)                            set content-type based on file extension
	flush()                                 flush output
	printout(...)                           like Lua's print but uses out()
	ppout(...)                              like pp() but uses out()

HTML ENCODING

	html(s) -> s                            escape html

URL ENCODING & DECODING

	url([path], [params]) -> t | s          encode/decode/update url
	absurl([path]) -> s                     get the absolute url for a path
	slug(id, s) -> s                        encode id and s to `s-id`

RESPONSE

	http_error(code[, fmt...])              raise a http error
	redirect(url[, status])                 exit with "302 moved temporarily"
	check(ret[, err...]) -> ret             exit with "404 file not found"
	allow(ret[, err...]) -> ret             exit with "403 forbidden"
	check_etag(s)                           exit with "304 not modified"

SCHEDULER

	sleep(n)                                sleep n seconds
	connect(ip, port) -> sock               connect to a server

JSON ENCODING/DECODING

	json(s) -> t                            decode json
	json(t) -> s                            encode json
	null                                    value to encode json `null`

FILESYSTEM

	wwwpath(file, [type]) -> path           get www subpath (and check if exists)
	wwwfile(file) -> s                      get file contents
	wwwfile.filename <- s|f(filename)       set virtual file contents
	wwwfiles([filter]) -> {name->true}      list www files
	varpath(file) -> path                   get var subpath (no check that it exists)
	varpath.filename <- s|f(filename)       set virtual file contents

MUSTACHE TEMPLATES

	render_string(s, [env], [part]) -> s    render a template from a string
	render_file(file, [env], [part]) -> s   render a template from a file
	mustache_wrap(s, name) -> s             wrap a template in <script> tag
	template(name) -> s                     get template contents
	template.name <- s|f(name)              set template contents or handler
	render(name[, env]) -> s                render template

LUAPAGES TEMPLATES

	include_string(s, [env], [name], ...)   run LuaPages script
	include(file, [env], ...)               run LuaPages script

LUA SCRIPTS

	run_string(s, [env], args...) -> ret    run Lua script
	run(file, [env], args...) -> ret        run Lua script

HTML FILTERS

	filter_lang(s, lang) -> s               filter <t> tags and :lang attrs
	filter_comments(s) -> s                 filter <!-- --> comments

FILE CONCATENATION LISTS

	catlist_files(s) -> {file1,...}         parse a .cat file
	catlist(file, args...)                  output a .cat file

MAIL SENDING

	sendmail(from, rcpt, subj, msg, html)   send email

HTTP SERVER INTEGRATION

	respond(req, http_respond, http_raise, http_debug) http_server response handler

STANDALONE OPERATION

	request(main, req | arg1,...)           make a request without a http server.

API DOCS ---------------------------------------------------------------------

	once(f[, clear_cache[, k]])

Memoize 0-arg or 1-arg function for current request. If `clear_cache` is
true, then clear the cache (either for the entire function or for arg `k`).

	env([t]) -> t

Per-request shared environment. Inherits _G. Scripts run with `include()`
and `run()` run in this environment by default. If the `t` argument is given,
an inherited environment is created.


]==]

glue = require'glue'
local uri = require'uri'

local concat = table.concat
local remove = table.remove
local insert = table.insert
local readfile = glue.readfile
local update = glue.update
local assertf = glue.assert
local memoize = glue.memoize
local _ = string.format

req_ctx = {} --initialized for use in standalone (no server) scripts.
local req, res, http_respond, http_raise, http_dbg, send_body

--config function ------------------------------------------------------------

local NIL = {}

do
	local conf = {}
	function config(var, default)
		if type(var) == 'table' then
			for var, val in pairs(var) do
				config(var, val)
			end
			return
		end
		local val = conf[var]
		if val == nil then
			val = os.getenv(var:upper())
			if val == nil then
				val = default
			end
			conf[var] = val == nil and NIL or val
		end
		if val == NIL then
			return nil
		else
			return val
		end
	end
end

--separate config function for internationalizing strings.
do
	local S_ = {}
	function S(name, val)
		if val and not S_[name] then
			S_[name] = val
		end
		return S_[name] or name
	end
end

--per-request environment ----------------------------------------------------

--per-request memoization.
do
	local function enc(v) if v == nil then return NIL else return v end end
	local function dec(v) if v == NIL then return nil else return v end end
	function once(f, clear_cache, ...)
		if clear_cache then
			local t = req_ctx[f]
			if t then
				if select('#', ...) == 0 then
					t = {}
					req_ctx[f] = t
				else
					local k = ...
					t[enc(k)] = nil
				end
			end
		else
			return function(k)
				local t = req_ctx[f]
				if not t then
					t = {}
					req_ctx[f] = t
				end
				local v = t[enc(k)]
				if v == nil then
					v = f(k)
					t[enc(k)] = enc(v)
				else
					v = dec(v)
				end
				return v
			end
		end
	end
end

--per-request shared environment to use in all app code.
function env(t)
	local env = req_ctx.env
	if not env then
		env = {__index = _G}
		setmetatable(env, env)
		req_ctx.env = env
	end
	if t then
		t.__index = env
		return setmetatable(t, t)
	else
		return env
	end
end

--logging --------------------------------------------------------------------

function log(...)
	http_dbg(...)
end

--request API ----------------------------------------------------------------

function method(which)
	if which then
		return req.method:lower() == which:lower()
	else
		return req.method:lower()
	end
end

function headers(h)
	if h then
		return req.headers[h]
	else
		return req.headers
	end
end

local _args = once(function()
	if req.args then
		return req.args
	end
	local t = uri.parse(req.uri).segments
	remove(t, 1)
	return t
end)
function args(v)
	if v then
		return _args()[v]
	else
		return _args()
	end
end

local _post_args = once(function()
	if not method'post' then return end
	local s = req:read_body'string'
	local ct = headers'content-type'
	if ct then
		if ct.media_type == 'application/x-www-form-urlencoded' then
			return uri.parse_args(s)
		elseif ct.media_type == 'application/json' then --prevent ENCTYPE CORS
			return s and json(s)
		end
	end
	return s
end)
function post(v)
	if v then
		local t = _post_args()
		return t and t[v]
	else
		return _post_args()
	end
end

function scheme(s)
	if s then
		return scheme() == s
	end
	return headers'x-forwarded-proto' or (req.http.tcp.istlssocket and 'https' or 'http')
end

function host(s)
	if s then
		return host() == s
	end
	return headers'x-forwarded-host'
		or (headers'host' and headers('host').host)
		or config'host'
		or req.http.tcp.local_addr
end

function port(p)
	if p then
		return port() == tonumber(p)
	end
	return headers'x-forwarded-port' or req.http.tcp.local_port
end

function email(user)
	return _('%s@%s', assert(user), host())
end

function client_ip()
	return headers'x-forwarded-for' or req.http.tcp.remote_addr
end

--arg validation

function id_arg(s)
	if not s or type(s) == 'number' then return s end
	local n = tonumber(s:match'(%d+)$') --strip any slug
	return n and n >= 0 and n or nil
end

function str_arg(s)
	s = glue.trim(s or '')
	return s ~= '' and s or nil
end

function enum_arg(s, ...)
	for i=1,select('#',...) do
		if s == select(i,...) then
			return s
		end
	end
	return nil
end

function list_arg(s, arg_f)
	local s = str_arg(s)
	if not s then return nil end
	arg_f = arg_f or str_arg
	local t = {}
	for s in glue.gsplit(s, ',', 1, true) do
		insert(t, arg_f(s))
	end
	return t
end

function checkbox_arg(s)
	return s == 'on' and 'checked' or nil
end

--output API -----------------------------------------------------------------

local function wrap_send_body(send)
	http_respond = nil
	http_raise = nil
	http_dbg = nil
	local req1, res1, req_ctx1, send_body1
	return function(buf, sz)
		send_body1 = send_body
		req_ctx1 = req_ctx
		req1 = req
		res1 = res
		req_ctx1 = req_ctx
		send(buf, sz)
		send_body = send_body1
		req_ctx = req_ctx1
		req = req1
		res = res1
		req_ctx = req_ctx1
	end
end

function setcontent(s)
	if send_body then
		out(s)
	else
		res.content = tostring(s)
		http_respond(res)
		http_respond = nil
	end
end

function outbuf(buf, sz)
	if not send_body then
		send_body = wrap_send_body(http_respond(res))
		http_respond = nil
	end
	send_body(buf, sz)
end

function out_buffering()
	return req_ctx.outfunc ~= nil
end

local function default_outfunc(...)
	for i=1,select('#',...) do
		local s = tostring((select(i,...)))
		if not send_body then
			send_body = wrap_send_body(http_respond(res))
			http_respond = nil
		end
		send_body(s)
	end
end

function stringbuffer(t)
	t = t or {}
	return function(...)
		local n = select('#',...)
		if n == 0 then --flush it
			return concat(t)
		end
		for i=1,n do
			local s = tostring(select(i,...))
			if s ~= '' then
				t[#t+1] = s
			end
		end
	end
end

function push_out(f)
	req_ctx.outfunc = f or stringbuffer()
	if not req_ctx.outfuncs then
		req_ctx.outfuncs = {}
	end
	insert(req_ctx.outfuncs, req_ctx.outfunc)
end

function pop_out()
	if not req_ctx.outfunc then return end
	local s = req_ctx.outfunc()
	local outfuncs = req_ctx.outfuncs
	remove(outfuncs)
	req_ctx.outfunc = outfuncs[#outfuncs]
	return s
end

function out(s, ...)
	if not res then return end --not a server context
	local outfunc = req_ctx.outfunc or default_outfunc
	outfunc(s, ...)
end

local function pass(...)
	return pop_out(), ...
end
function record(out_content, ...)
	push_out()
	return pass(out_content(...))
end

function setheader(name, val)
	if out_buffering() then
		return
	end
	res.headers[name] = val
end

mime_types = {
	html = 'text/html',
	txt  = 'text/plain',
	sh   = 'text/plain',
	css  = 'text/css',
	json = 'application/json',
	js   = 'application/javascript',
	jpg  = 'image/jpeg',
	jpeg = 'image/jpeg',
	png  = 'image/png',
	gif  = 'image/gif',
	ico  = 'image/x-icon',
	svg  = 'image/svg+xml',
	ttf  = 'font/ttf',
	woff = 'font/woff',
	woff2= 'font/woff2',
	pdf  = 'application/pdf',
	zip  = 'application/zip',
	gz   = 'application/x-gzip',
	tgz  = 'application/x-gzip',
	xz   = 'application/x-xz',
	bz2  = 'application/x-bz2',
	tar  = 'application/x-tar',
	mp3  = 'audio/mpeg',
}

function setmime(ext)
	setheader('content-type', mime_types[ext])
end

local function print_wrapper(out)
	return function(...)
		if not out_buffering() then
			if res then
				setheader('content-type', 'text/plain')
			end
			out(...)
		else
			out(...)
		end
	end
end

flush = glue.noop

--print functions for debugging with no output buffering and flushing.

pp = require'pp'

printout = print_wrapper(glue.printer(tostring))
ppout = print_wrapper(glue.printer(pp))

--sockets --------------------------------------------------------------------

local sock = require'sock'

newthread = sock.newthread
resume = sock.resume
suspend = sock.suspend
thread = sock.thread
sleep = sock.sleep
srun = sock.run

function connect(host, port)
	local skt = sock.tcp()
	local ok, err = skt:connect(host, port)
	if not ok then return nil, err end
	return skt
end

--html encoding --------------------------------------------------------------

function html(s)
	if s == nil then return '' end
	return (tostring(s):gsub('[&"<>\\]', function(c)
		if c == '&' then return '&amp;'
		elseif c == '"' then return '\"'
		elseif c == '\\' then return '\\\\'
		elseif c == '<' then return '&lt;'
		elseif c == '>' then return '&gt;'
		else return c end
	end))
end

--url encoding/decoding ------------------------------------------------------

--use cases:
--  decode url: url('a/b?a&b=1') -> {'a', 'b', a=true, b='1'}
--  encode url: url{'a', 'b', a=true, b='1'} -> 'a/b?a&b=1'
--  update url: url('a/b?a&b=1', {'c', b=2}) -> 'c/b?a&b=2'
--  decode params only: url(nil, 'a&b=1') -> {a=true, b=1}
--  encode params only: url(nil, {a=true, b=1}) -> 'a&b=1'
function url(path, params)
	if type(path) == 'string' then --decode or update url
		local t = uri.parse(path)
		if params then --update url
			update(t, params) --also updates any path elements
			return url(t) --re-encode url
		else --decode url
			return t
		end
	elseif path then --encode url
		local s1 = uri.format(path)
	else --encode or decode params only
		if type(params) == 'table' then
			return uri.format_args(params)
		else
			return uri.parse_args(params)
		end
	end
end

if false then
	local p = print
	p(pp.format(url('a/b?a&b=1')))
	p(url{'a', 'b', a=true, b=1})
	p()
	p(pp.format(url('?a&b=1')))
	p(url{'', a=true, b=1})
	p()
	p(pp.format(url('a/b?')))
	p(url{'a', 'b', ['']=true})
	p()
	p(pp.format(url('a/b')))
	p(url{'a', 'b'})
	p()
	p(url('a/b?a&b=1', {'c', b=2}))
	p()
	p(pp.format(url(nil, 'a&b=1')))
	p(url(nil, {a=true, b=1}))
	p()
end

function absurl(path)
	path = path or ''
	return config'base_url' or
		scheme()..'://'..host()..
			(((scheme'https' and port(443)) or
			  (scheme'http' and port(80))) and '' or ':'..port())..path
end

function slug(id, s)
	s = glue.trim(s or '')
		:gsub('[%s_;:=&@/%?]', '-') --turn separators into dashes
		:gsub('%-+', '-')           --compress dashes
		:gsub('[^%w%-%.,~]', '')    --strip chars that would be url-encoded
		:lower()
	assert(id >= 0)
	return (s ~= '' and s..'-' or '')..tostring(id)
end

--response API ---------------------------------------------------------------

function http_error(status, fmt, ...)
	local msg = type(fmt) == 'string' and _(fmt, ...) or fmt
	http_raise{status = status, status_message = msg and tostring(msg)}
end

function redirect(uri)
	--TODO: make it work with relative paths
	http_raise{status = 303, headers = {location = uri}}
end

function check(ret, ...)
	if ret then return ret end
	http_error(404, ...)
end

function allow(ret, ...)
	if ret then return ret end
	http_error(403, ...)
end

--TODO: update xxHash and use xxHash128 for this.
local md5 = require'md5'

function check_etag(s)
	if not method'get' then return s end
	if out_buffering() then return s end
	local etag = glue.tohex(md5.sum(s))
	local etags = headers'if-none-match'
	if etags and type(etags) == 'table' then
		for _,t in ipairs(etags) do
			if t.etag == etag then
				http_error(304)
			end
		end
	end
	--send etag to client as weak etag so that gzip filter still apply.
	setheader('etag', 'W/'..etag)
	return s
end

--json API -------------------------------------------------------------------

local cjson = require'cjson'
cjson.encode_sparse_array(false, 0, 0) --encode all sparse arrays

null = cjson.null

function json(v)
	if type(v) == 'table' then
		return cjson.encode(v)
	elseif type(v) == 'string' then
		return cjson.decode(v)
	elseif v == nil then
		return nil
	else
		error('invalid arg '..type(v))
	end
end

function out_json(v)
	setmime'json'
	setcontent(cjson.encode(v))
end

--filesystem API -------------------------------------------------------------

local fs = require'fs'
local path = require'path'

function wwwpath(file, type)
	assert(file)
	if file:find('..', 1, true) then return end --TODO: use path module for this
	local abs_path = assert(path.combine(config'www_dir', file))
	if fs.is(abs_path, type) then return abs_path end
	local abs_path = assert(path.combine('.', file))
	if fs.is(abs_path, type) then return abs_path end
	return nil, file..' not found'
end

function varpath(file)
	return assert(path.combine(config'var_dir' or config'www_dir', file))
end

local function file_object(findfile) --{filename -> content | handler(filename)}
	return setmetatable({}, {
		__call = function(self, file)
			local f = self[file]
			if type(f) == 'function' then
				return f()
			elseif f then
				return f
			else
				local file = findfile(file)
				return file and readfile(file)
			end
		end,
	})
end
wwwfile = file_object(wwwpath)
varfile = file_object(varpath)

function wwwfiles(filter)
	filter = filter or glue.pass
	local t = {}
	for name in pairs(wwwfile) do
		if filter(name) then
			t[name] = true
		end
	end
	for name, d in fs.dir(config'www_dir') do
		if not t[name] and d:is'file' and filter(name) then
			t[name] = true
		end
	end
	for name, d in fs.dir'.' do
		if not t[name] and d:is'file' and filter(name) then
			t[name] = true
		end
	end
	return t
end

--mustache html templates ----------------------------------------------------

local function underscores(name)
	return name:gsub('-', '_')
end

local mustache = require'mustache'

function render_string(s, data, partials)
	return (mustache.render(s, data, partials))
end

function render_file(file, data, partials)
	return render_string(wwwfile(file), data, partials)
end

function mustache_wrap(s, name)
	return '<script type="text/x-mustache" id="'..name..
		'_template">\n'..s..'\n</script>\n'
end

local function check_template(name, file)
	assertf(not template[name], 'duplicate template "%s" in %s', name, file)
end

--TODO: make this parser more robust so we can have <script> tags in templates
--without the <{{undefined}}/script> hack (mustache also needs it though).
local function mustache_unwrap(s, t, file)
	t = t or {}
	local i = 0
	for name,s in s:gmatch('<script%s+type=?"text/x%-mustache?"%s+'..
		'id="?(.-)_template"?>(.-)</script>') do
		name = underscores(name)
		if t == template then
			check_template(name, file)
		end
		t[name] = s
		i = i + 1
	end
	return t, i
end

local template_names = {} --keep template names in insertion order

local function add_template(template, name, s)
	name = underscores(name)
	rawset(template, name, s)
	insert(template_names, name)
end

--gather all the templates from the filesystem
local load_templates = memoize(function()
	local t = wwwfiles(function(s) return s:find'%.html%.mu$' end)
	t = glue.keys(t)
	for i,file in ipairs(t) do
		local s = wwwfile(file)
		local _, i = mustache_unwrap(s, template, file)
		if i == 0 then --must be without the <script> tag
			local name = file:gsub('%.html%.mu$', '')
			name = underscores(name)
			check_template(name, file)
			template[name] = s
		end
	end
end)

local function template_call(template, name)
	load_templates()
	if not name then
		return template_names
	else
		name = underscores(name)
		local s = assertf(template[name], 'template not found: %s', name)
		if type(s) == 'function' then
			s = s()
		end
		return s
	end
end

template = {} --{template = html | handler(name)}
setmetatable(template, {__call = template_call, __newindex = add_template})

local partials = {}
local function get_partial(partials, name)
	return template(name)
end
setmetatable(partials, {__index = get_partial})

function render(name, data)
	return render_string(template(name), data, partials)
end

--LuaPages templates ---------------------------------------------------------

local function lp_out(s, i, f)
	s = s:sub(i, f or -1)
	if s == '' then return s end
	-- we could use `%q' here, but this way we have better control
	s = s:gsub('([\\\n\'])', '\\%1')
	-- substitute '\r' by '\'+'r' and let `loadstring' reconstruct it
	s = s:gsub('\r', '\\r')
	return _(' out(\'%s\'); ', s)
end

local function lp_translate(s)
	s = s:gsub('^#![^\n]+\n', '')
	s = s:gsub('<%%(.-)%%>', '<?lua %1 ?>"')
	local res = {}
	local start = 1 --start of untranslated part in `s'
	while true do
		local ip, fp, target, exp, code = s:find('<%?(%w*)[ \t]*(=?)(.-)%?>', start)
		if not ip then
			ip, fp, target, exp, code = s:find('<%?(%w*)[ \t]*(=?)(.*)', start)
			if not ip then
				break
			end
		end
		insert(res, lp_out(s, start, ip-1))
		if target ~= '' and target ~= 'lua' then
			--not for Lua; pass whole instruction to the output
			insert(res, lp_out(s, ip, fp))
		else
			if exp == '=' then --expression?
				insert(res, _(' out(%s);', code))
			else --command
				insert(res, _(' %s ', code))
			end
		end
		start = fp + 1
	end
	insert(res, lp_out(s, start))
	return concat(res)
end

local function lp_compile(s, chunkname, env)
	local s = lp_translate(s)
	return assert(load(s, chunkname, 'bt', env))
end

local function lp_include(filename, env)
	local s = readfile(filename)
	local prog = lp_compile(src, '@'..filename, env)
	prog()
end

local function compile_string(s, chunkname)
	local f = lp_compile(s, chunkname)
	return function(_env, ...)
		setfenv(f, _env or env())
		f(...)
	end
end

local compile = memoize(function(file)
	return compile_string(wwwfile(file), '@'..file)
end)

function include_string(s, env, chunkname, ...)
	return compile_string(s, chunkname)(env, ...)
end

function include(file, env, ...)
	compile(file)(env, ...)
end

--Lua scripts ----------------------------------------------------------------

local function compile_lua_string(s, chunkname)
	local f = assert(loadstring(s, chunkname))
	return function(_env, ...)
		setfenv(f, _env or env())
		return f(...)
	end
end

local compile_lua = memoize(function(file)
	return compile_lua_string(wwwfile(file), file)
end)

function run_string(s, env, ...)
	return compile_lua_string(s)(env, ...)
end

function run(file, env, ...)
	return compile_lua(file)(env, ...)
end

--html filters ---------------------------------------------------------------

function filter_lang(s, lang)
	local lang0 = lang

	--replace <t class=lang>
	s = s:gsub('<t class=([^>]+)>(.-)</t>', function(lang, html)
		assert(not html:find('<t class=', 1, true), html)
		if lang ~= lang0 then return '' end
		return html
	end)

	--replace attr:lang="val" and attr:lang=val
	local function repl_attr(attr, lang, val)
		if lang ~= lang0 then return '' end
		return attr .. val
	end
	s = s:gsub('(%s[%w_%:%-]+)%:(%a?%a?)(=%b"")', repl_attr)
	s = s:gsub('(%s[%w_%:%-]+)%:(%a?%a?)(=[^%s>]*)', repl_attr)

	return s
end

function filter_comments(s)
	return (s:gsub('<!%-%-.-%-%->', ''))
end

--concatenated files preprocessor --------------------------------------------

--NOTE: duplicates are ignored to allow require()-like functionality
--when composing file lists from independent modules (see jsfile and cssfile).
function catlist_files(s)
	s = s:gsub('//[^\n\r]*', '') --strip out comments
	local already = {}
	local t = {}
	for file in s:gmatch'([^%s]+)' do
		if not already[file] then
			already[file] = true
			insert(t, file)
		end
	end
	return t
end

--NOTE: can also concatenate actions if the actions module is loaded.
--NOTE: favors plain files over actions because it can generate etags without
--actually reading the files.
function catlist(listfile, ...)
	local js = listfile:find'%.js%.cat$'
	local sep = js and ';\n' or '\n'

	--generate and check etag
	local t = {} --etag seeds
	local c = {} --output generators

	for i,file in ipairs(catlist_files(wwwfile(listfile))) do
		if wwwfile[file] then --virtual file
			insert(t, wwwfile(file))
			insert(c, function() out(wwwfile(file)) end)
		else
			local path = wwwpath(file)
			if path then --plain file, get its mtime
				local mtime = fs.attr(path, 'mtime')
				insert(t, tostring(mtime))
				insert(c, function() out(readfile(path)) end)
			elseif action then --file not found, try an action
				local s, found = record(action, file, ...)
				if found then
					insert(t, s)
					insert(c, function() out(s) end)
				else
					assertf(false, 'file not found: %s', file)
				end
			else
				assertf(false, 'file not found: %s', file)
			end
		end
	end
	check_etag(concat(t, '\0'))

	--output the content
	for i,f in ipairs(c) do
		f()
		out(sep)
	end
end

--mail sending ---------------------------------------------------------------

local function strip_name(email)
	return '<'..(email:match'<(.-)>' or email)..'>'
end

function sendmail(from, rcpt, subj, msg, html)
	--TODO: integrate a few "transactional" email providers here.
	return send{
		from = strip_name(from),
		rcpt = {
			strip_name(rcpt),
			strip_name(from),
		},
		headers = {
			from = from,
			to = rcpt,
			subject = subj,
			['content-type'] = html and 'text/html' or 'text/plain'
		},
		body = msg,
		server = config('smtp_host', '127.0.0.1'),
		port   = config('smtp_port', 25),
	}
end

--http_server respond function -----------------------------------------------

function respond(req1, http_respond1, http_raise1, http_dbg1)
	req = req1
	req_ctx = {}
	res = {headers = {}}
	send_body = nil
	http_respond = http_respond1
	http_raise = http_raise1
	http_dbg = http_dbg1
	local main = assert(config'main_module')
	local main = type(main) == 'string' and require(main) or main
	if type(main) == 'table' then
		main = main.respond
	end
	main()

	return res
end

--standalone operation -------------------------------------------------------

function request(main, arg1, ...)
	config('main_module', main)
	local host = 'localhost' --TODO
	local req = type(arg1) == 'table' and arg1 or {args = {arg1,...}}
	req = update({
			method = 'get',
		}, req)
	req.headers = update({
			host = host,
		}, req.headers)
	req.http = update({
		}, req.http)
	req.http.tcp = update({
			istlssocket = true,
			local_addr = 'localhost',
			local_port = nil,
			remote_addr = nil,
		}, req.http.tcp)
	local function respond_with(opt)
		pp(opt)
	end
	local function raise_with(err)
		errors.raise('http_response', err)
	end
	local function log_with(...)
		print('LOG', ...)
	end
	srun(function()
		local res = respond(req, respond_with, raise_with, log_with)
		pp(res)
	end)
end

return respond
