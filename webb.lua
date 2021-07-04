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

REQUEST CONTEXT

	once(f, ...)                            memoize for current request
	cx() -> t                               per-request shared context
	env([t]) -> t                           per-request shared environment
	on_cleanup(f)                           add a request finalizer

LOGGING

	log(event, fmt, ...)
	trace(event, fmt, ...) -> log

REQUEST

	headers([name]) -> s|t                  get header or all
	cookie(name) -> s | nil                 get cookie value
	method([method]) -> s|b                 get/check http method
	post([name]) -> s | t | nil             get POST arg or all
	upload(file) -> true | nil              upload POST data to a file
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
	out(s)                                  output one more non-nil value
	push_out([f])                           push output function or buffer
	pop_out() -> s                          pop output function and flush it
	stringbuffer([t]) -> f(s1,...)/f()->s   create a string buffer
	record(f) -> s                          run f and collect out() calls
	out_buffering() -> t | f                check if we're buffering output
	setheader(name, val)                    set a header (unless we're buffering)
	setmime(ext)                            set content-type based on file extension
	outprint(...)                           like Lua's print but uses out()
	outfile(path)                           buffered out(readfile(path))

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

SOCKETS

	sleep(n)                                sleep n seconds
	connect(ip, port) -> sock               connect to a server
	resolve(host) -> ip                     DNS-resolve a host name
	newthread(f) -> thread                  create thread
	thread(f, ...) -> thread                create and run thread
	resume(thread, ...) -> ...              resume thread
	suspend(thread) -> ...                  suspend thread
	srun(f)                                 run function in thread
	resolve(host) -> ip4                    resolve a hostname

HTTP REQUESTS

	getpage(url,post_data | opt) -> req     make a HTTP request

JSON ENCODING/DECODING

	json(s) -> t                            decode json
	json(t) -> s                            encode json
	null                                    value to encode json `null`

FILESYSTEM

	wwwpath(file, [type]) -> path           get www subpath (and check if exists)
	wwwfile(file) -> s                      get file contents
	wwwfile.filename <- s|f(filename)       set virtual file contents
	wwwfiles([filter]) -> {name->true}      list www files
	outwwwfile(file)                        buffered out(readfile(file))
	varpath(file) -> path                   get var subpath (no check that it exists)
	varpath.filename <- s|f(filename)       set virtual file contents

	fileext(s) -> s                         get file extension (in lowercase)
	mkdirs(file) -> file | nil              make dirs for file path
	fileexists(file, [type]) -> file | nil  check if file exists
	filemtime(file) -> mtime                get file mtime
	filename(filepath) -> file              get file name from full path
	filedir(filepath) -> dir                get dir name from full path

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
	outcatlist(file, args...)               output a .cat file

MAIL SENDING

	sendmail(from, rcpt, subj, msg, html)   send email

IMAGE PROCESSING

	resize_image(src_path, dst_path, max_w, max_h)
	base64_image_src(s)

HTTP SERVER INTEGRATION

	webb_respond(req)                       http_server response handler
	webb_cleanup()
	http_server([opt]) -> server

STANDALONE OPERATION

	request(req | arg1,...)                 make a request without a http server.

API DOCS ---------------------------------------------------------------------

	once(f)

Memoize function for current request.

	env([t]) -> t

Per-request shared environment. Inherits _G. Scripts run with `include()`
and `run()` run in this environment by default. If the `t` argument is given,
an inherited environment is created.


]==]

glue = require'glue'
pp = require'pp'
local uri = require'uri'
local errors = require'errors'
local sock = require'sock'
local cjson = require'cjson'
local b64 = require'libb64'
local fs = require'fs'
local path = require'path'
local mustache = require'mustache'

local concat = table.concat
local remove = table.remove
local insert = table.insert
local readfile = glue.readfile
local update = glue.update
local assertf = glue.assert
local memoize = glue.memoize
local _ = string.format

errors.errortype'http_response'.__tostring = function(self)
	local s = self.traceback or self.message or ''
	if self.status then
		s = self.status .. ' ' .. s
	end
	return s
end

--thread context switching ---------------------------------------------------

--request context for current thread.
local cx = {req = {dbg = function(self, topic, ...) print(topic, _(...)) end}}

local thread_cx = setmetatable({}, {__mode = 'k'})
function sock.save_thread_context(thread)
	thread_cx[thread] = cx
end
function sock.restore_thread_context(thread)
	cx = thread_cx[thread]
end

function _G.cx() return cx end

--config function ------------------------------------------------------------

do
	local conf = {}
	function config(var, default)
		if type(var) == 'table' then
			for var, val in pairs(var) do
				config(var, val)
			end
		else
			local val = conf[var]
			if val == nil then
				val = default
			end
			conf[var] = val
			return val
		end
	end

	function with_config(t, f, ...)
		local old_conf = conf
		local function pass(...)
			conf = old_conf
			return ...
		end
		conf = setmetatable(t, {__index = old_conf})
		return pass(f(...))
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
function once(f)
	return function(...)
		local ret = cx[f]
		if not ret then
			ret = f(...)
			cx[f] = ret
		end
		return ret
	end
end

--per-request shared environment to use in all app code.
function env(t)
	local env = cx.env
	if not env then
		env = {__index = _G}
		setmetatable(env, env)
		cx.env = env
	end
	if t then
		t.__index = env
		return setmetatable(t, t)
	else
		return env
	end
end

--logging --------------------------------------------------------------------

function log(event, s, ...)
	cx.req:dbg(event, s, ...)
end

function trace(event, s, ...)
	if not event then
		print(debug.traceback())
		return
	end
	log(event, '%4.2f '..s, 0, ...)
	local t0 = time()
	return function(event, s, ...)
		local dt = time() - t0
		log(event, '%4.2f '..s, dt, ...)
	end
end

--request API ----------------------------------------------------------------

function method(which)
	if which then
		return cx.req.method:lower() == which:lower()
	else
		return cx.req.method:lower()
	end
end

function headers(h)
	if h then
		return cx.req.headers[h]
	else
		return cx.req.headers
	end
end

function cookie(name)
	local t = cx.req.headers.cookie
	return t and t[name]
end

function args(v)
	local args = cx.req.args or cx.args
	if not args then
		local u = uri.parse(cx.req.uri)
		args = u.segments
		remove(args, 1)
		if u.args then
			for i = 1, #u.args, 2 do
				local k,v = u.args[i], u.args[i+1]
				args[k] = v
			end
		end
		cx.args = args
	end
	if v then
		return args[v]
	else
		return args
	end
end

function post(v)
	if not method'post' then
		return
	end
	local post = cx.post
	if not post then
		local s = cx.req:read_body'string'
		local ct = headers'content-type'
		if ct then
			if ct.media_type == 'application/x-www-form-urlencoded' then
				post = uri.parse_args(s)
			elseif ct.media_type == 'application/json' then --prevent ENCTYPE CORS
				post = s and json(s)
			end
		else
			post = s
		end
		cx.post = post
	end
	if v then
		return post[v]
	else
		return post
	end
end

function upload(file)
	return glue.fcall(function(finally)
		local f = assert(fs.open(file..'.tmp', 'w'))
		finally(function() f:close() end)
		local function write(buf, sz)
			assert(f:write(buf, sz))
		end
		cx.req:read_body(write)
		assert(f:close())
		assert(fs.move(file..'.tmp', file))
		return file
	end)
end

function scheme(s)
	if s then
		return scheme() == s
	end
	return headers'x-forwarded-proto'
		or (cx.req.http.tcp.istlssocket and 'https' or 'http')
end

function host(s)
	if s then
		return host() == s
	end
	return headers'x-forwarded-host'
		or (headers'host' and headers'host'.host)
		or config'host'
		or cx.req.http.tcp.local_addr
end

function port(p)
	if p then
		return port() == tonumber(p)
	end
	return headers'x-forwarded-port'
		or cx.req.http.tcp.local_port
end

function email(user)
	return _('%s@%s', assert(user), host())
end

function client_ip()
	return headers'x-forwarded-for'
		or cx.req.http.tcp.remote_addr
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

function setcontent(s)
	if cx.send_body or out_buffering() then
		out(s)
	else
		cx.res.content = s ~= nil and tostring(s) or ''
		cx.req:respond(cx.res)
	end
end

function out_buffering()
	return cx.outfunc ~= nil
end

local function default_outfunc(s, len)
	if s == nil or s == '' or len == 0 then
		return
	end
	if not cx.send_body then
		cx.send_body = cx.req:respond(cx.res)
	end
	s = type(s) ~= 'cdata' and tostring(s) or s
	cx.send_body(s, len)
end

function stringbuffer(t)
	t = t or {}
	return function(...)
		local n = select('#',...)
		if n == 0 then --flush it
			return concat(t)
		else
			local s, len = ...
			if s == nil or s == '' or len == 0 then
				return
			end
			if type(s) == 'cdata' then
				assert(len)
				s = ffi.string(s, len)
			else
				assert(not len)
				s = tostring(s)
			end
			t[#t+1] = s
		end
	end
end

function push_out(f)
	cx.outfunc = f or stringbuffer()
	if not cx.outfuncs then
		cx.outfuncs = {}
	end
	insert(cx.outfuncs, cx.outfunc)
end

function pop_out()
	if not cx.outfunc then return end
	local s = cx.outfunc()
	local outfuncs = cx.outfuncs
	remove(outfuncs)
	cx.outfunc = outfuncs[#outfuncs]
	return s
end

function out(s, len)
	if not cx.res then return end --not a server context
	local outfunc = cx.outfunc or default_outfunc
	outfunc(s, len)
end

local function pass_record(...)
	return pop_out(), ...
end
function record(f, ...)
	push_out()
	return pass_record(f(...))
end

function outfile(path)
	out(readfile(path)) --TODO: make it buffered
end

function setheader(name, val)
	if out_buffering() then
		return
	end
	cx.res.headers[name] = val
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

mime_types_compressed = glue.index{
	'image/jpeg',
	'image/png',
	'font/woff',
	'font/woff2',
	'application/zip',
	'application/x-gzip',
	'application/x-gzip',
	'application/x-xz',
	'application/x-bz2',
	'audio/mpeg',
}

function setmime(ext)
	setheader('content-type', mime_types[ext])
end

local function print_wrapper(out)
	return function(s)
		if not out_buffering() then
			if cx.res then
				setheader('content-type', 'text/plain')
			end
			out(s)
		else
			out(s)
		end
	end
end

--print functions for debugging with no output buffering and flushing.

outprint = print_wrapper(glue.printer(tostring))
outpp    = print_wrapper(glue.printer(pp))

--sockets --------------------------------------------------------------------

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

--dns resolver ---------------------------------------------------------------

local resolver
function resolve(host)
	resolver = resolver or require'resolver'.new{
		servers = config('ns', {
			'1.1.1.1', --cloudflare
			'8.8.8.8', --google
		}),
	}
	local addrs, err = resolver:lookup(host)
	return addrs and addrs[1], err
end

--http requests --------------------------------------------------------------

local getpage_client

function getpage(arg1, post_data)
	local opt = type(arg1) == 'table' and arg1

	if not getpage_client then

		local http_client = require'http_client'

		getpage_client = http_client:new(update({
			libs = 'sock sock_libtls zlib',
			resolve = function(_, host) return resolve(host) end,
		}, opt))

	end

	local headers = {}
	if type(post_data) == 'table' then
		post_data = json(post_data)
		headers.content_type = mime_types.json
	end

	local u = type(arg1) == 'string' and url(arg1) or arg1.url and opt(arg1.url)

	local res, req, err_class = getpage_client:request(update({
		host = u and u.host,
		uri = u and u.path,
		https = (u and u.scheme and u.scheme or scheme()) == 'https',
		method = post_data and 'POST',
		headers = headers,
		content = post_data,
		receive_content = 'string',
		debug = {protocol = true, stream = false},
		--close = true,
	}, opt))

	if not res then
		return nil, req, err_class
	end

	local s = res.content
	local ct = res.headers['content-type']
	if ct and ct.media_type == mime_types.json then
		s = json(s)
	end
	return s
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

function http_error(...)
	cx.req:raise(...)
end

function redirect(uri)
	--TODO: make it work with relative paths
	http_error{status = 303, headers = {location = uri}}
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

function fileext(s)
	return path.ext(s)
end

function wwwpath(file, type)
	assert(file)
	if file:find('..', 1, true) then return end --TODO: use path module for this
	--look into www_dir
	local abs_path = assert(path.combine(config'www_dir', file))
	if fs.is(abs_path, type) then return abs_path end
	--look into luapower dir
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
		if not name then
			break
		end
		if not t[name] and d:is'file' and filter(name) then
			t[name] = true
		end
	end
	for name, d in fs.dir'.' do
		if not name then
			break
		end
		if not t[name] and d:is'file' and filter(name) then
			t[name] = true
		end
	end
	return t
end

function outwwwfile(file)
	out(wwwfile(file)) --TODO: make it buffered
end

function mkdirs(file)
	local dir = assert(path.dir(file))
	if path.dir(dir) then --because mkdir'c:/' gives access denied.
		assert(fs.mkdir(dir, true))
	end
	return file
end

function fileexists(file, type)
	return fs.is(file, type)
end

function filemtime(file, type)
	return fs.attr(file, 'mtime')
end

function filename(file)
	return path.file(file)
end

function filedir(file)
	return path.dir(file)
end

--mustache html templates ----------------------------------------------------

local function underscores(name)
	return name:gsub('-', '_')
end

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

--gather all the templates from the filesystem.
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
	return function(env_, ...)
		setfenv(f, env_ or env())
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
function outcatlist(listfile, ...)
	local js = listfile:find'%.js%.cat$'
	local sep = js and ';\n' or '\n'

	--generate and check etag
	local t = {} --etag seeds
	local c = {} --output generators

	for i,file in ipairs(catlist_files(wwwfile(listfile))) do
		if wwwfile[file] then --virtual file
			local s = wwwfile(file)
			insert(t, s)
			insert(c, function() out(s) end)
		else
			local path = wwwpath(file)
			if path then --plain file, get its mtime
				local mtime = fs.attr(path, 'mtime')
				insert(t, tostring(mtime))
				insert(c, function() outfile(path) end)
			elseif action then --file not found, try an action
				local s, found = record(exec, file, ...)
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

--image processing -----------------------------------------------------------

function resize_image(src_path, dst_path, max_w, max_h)

	local cairo = require'cairo'
	local box2d = require'box2d'

	glue.fcall(function(finally)

		--decode.
		local bmp
		local src_ext = fileext(src_path)
		if src_ext == 'jpg' or src_ext == 'jpeg' then
			local libjpeg = require'libjpeg'
			local f = assert(fs.open(src_path, 'r'), 'not_found')
			finally(function() f:close() end)
			local read = f:buffered_read()
			local img = assert(libjpeg.open{read = read})
			finally(function() img:free() end)
			local w, h = box2d.fit(img.w, img.h, max_w, max_h)
			local sn = math.ceil(glue.clamp(math.max(w / img.w, h / img.h) * 8, 1, 8))
			bmp = assert(img:load{
				accept = {bgra8 = true},
				scale_num = sn,
				scale_denom = 8,
			})
		else
			assert(false)
		end

		--scale down, if necessary.
		local w, h = box2d.fit(bmp.w, bmp.h, max_w, max_h)
		if w < bmp.w or h < bmp.h then
			local src_sr = cairo.image_surface(bmp)
			local dst_sr = cairo.image_surface('bgra8', w, h)
			local cr = dst_sr:context()
			local sx = w / bmp.w
			local sy = h / bmp.h
			cr:scale(sx, sy)
			cr:source(src_sr)
			cr:paint()
			cr:free()
			src_sr:free()
			bmp = dst_sr:bitmap()
			finally(function() dst_sr:free() end)
		end

		--encode back.
		local dst_ext = fileext(dst_path)
		if dst_ext == 'jpg' or dst_ext == 'jpeg' then
			local libjpeg = require'libjpeg'
			local tmp_path = dst_path..'.tmp'
			mkdirs(tmp_path)
			local f = assert(fs.open(tmp_path, 'w'))
			finally(function() if f then f:close() end end)
			local function write(buf, len)
				assert(f:write(buf, len) == len)
			end
			assert(libjpeg.save{
				bitmap = bmp,
				write = write,
				quality = 90,
			})
			f:close()
			f = nil
			local ok, err = glue.replacefile(tmp_path, dst_path)
			if not ok then
				os.remove(tmp_path)
				assertf(false, 'glue.replacefile(%s, %s): %s', tmp_path, dst_path, err)
			end
		else
			assert(false)
		end

	end)

end

function base64_image_src(s)
	return 'data:image/png;base64, '..b64.encode(s)
end

--http_server respond function -----------------------------------------------

function webb_respond(req, thread)
	cx = {req = req, res = {headers = {}}}
	thread_cx[thread] = cx
	log(req.method, '%s', req.uri)
	local main = assert(config'main_module')
	local main = type(main) == 'string' and require(main) or main
	if type(main) == 'table' then
		main = main.respond
	end
	on_cleanup(function()
		cx = nil
		thread_cx[thread] = nil
	end)
	main()
end

do
function webb_cleanup()
	if cx.cleanup then
		for _,f in ipairs(cx.cleanup) do
			f()
		end
	end
end
function on_cleanup(f)
	add(attr(cx, 'cleanup'), f)
end
end

--standalone operation -------------------------------------------------------

function request(arg1, ...)
	local function main()
		check(action(unpack(args())))
	end
	with_config({main_module = main}, function(...)
		local host = 'localhost' --TODO
		local req = type(arg1) == 'table' and arg1 or {args = {arg1,...}}
		req = update({
				method = 'get',
				uri = concat(map(pack('', arg1, ...), tostring), '/'),
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
		req.respond = function(self, ...)
			pp(...)
		end
		req.dbg = cx.req.dbg
		srun(function()
			local res = webb_respond(req, coroutine.running())
		end)
	end, ...)
end

--pre-configured http app server ---------------------------------------------

function http_server(opt)
	local server = require'http_server'
	local host       = config('host', 'localhost')
	local http_addr  = config('http_addr', '127.0.0.1')
	local https_addr = config('https_addr', false)
	return server:new(update({
		libs = 'zlib sock '..(config'https_addr' and 'sock_libtls' or ''),
		listen = {
			{
				host = host,
				addr = https_addr,
				port = config'https_port',
				tls = true,
				tls_options = {
					cert_file = config('https_cert_file', host..'.crt'),
					key_file  = config('https_key_file' , host..'.key'),
				},
			},
			{
				host = host,
				addr = http_addr,
				port = config'http_port',
			},
		},
		debug = {
			--protocol = true,
			--stream = true,
			--tracebacks = true,
		},
		respond = webb_respond,
		cleanup = webb_cleanup,
	}, opt))
end
