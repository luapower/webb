--[==[

	webb | single-page apps | server-side API
	Written by Cosmin Apreutesei. Public Domain.

CONFIG

	config('page_title_suffix')         suffix for <title>
	config('js_mode')                   'bundle' | 'ref' | 'separate'
	config('css_mode')                  'bundle' | 'ref' | 'separate'

API

	cssfile(file)                       add one or more css files to all.css
	jsfile(file)                        add one or more js files to all.js
	css(s)                              add css code to inline.css
	js(s)                               add js code to inline.js

	page_title([title], [body]) -> s    set/infer page title

	spa(t)                              single-page app html action
		t.head: s                        content for <head>
		t.body: s                        content for <body>
		t.title: s                       content for <title> (optional)
		t.client_action: t|f             should run client-side action or not


INTERNAL API

	action['config.js']                 expose required config() values
	action['strings.js']                load strings.<lang>.js
	action['all.js']                    output of jsfile() calls
	action['all.css']                   output of cssfile() calls
	action['inline.js']                 output of js() calls
	action['inline.css']                output of css() calls

	config'aliases'                     for lang_url() and find_action()
	config'page_title_suffix'           for pagetitle()

	config'facebook_app_id'             for webb.auth.facebook.js
	config'google_client_id'            for webb.auth.google.js
	config'analytics_ua'                for webb.analytics.js

LOADS

	glue.js
	divs.js
	webb_spa.js
	mustache.js

]==]

require'webb'
require'webb_action'

--pass required config values to the client
action['config.js'] = function()

	local cjson = require'cjson'

	--initialize some required config values with defaults.
	config('lang', 'en')
	config('root_action', 'en')
	config('page_title_suffix', ' - '..host())

	local function C(name)
		if config(name) == nil then return end
		out('config('
			..cjson.encode(name)..', '
			..cjson.encode(config(name))..')\n')
	end

	C'lang'
	C'aliases'
	C'root_action'
	C'templates_action'
	C'page_title_suffix'

	C'facebook_app_id'
	C'analytics_ua'
	C'google_client_id'

end

--organize string translations in separate files for each langauge
action['strings.js'] = function()
	if lang() == 'en' then return end
	action('strings.'..lang()..'.js')
end

--simple API to add js and css snippets and files from server-side code

local function sepbuffer(sep)
	local buf = stringbuffer()
	return function(s)
		if s then
			buf(s)
			buf(sep)
		else
			return buf()
		end
	end
end

cssfile = sepbuffer'\n'
wwwfile['all.css.cat'] = function()
	return cssfile() .. ' inline.css' --append inline code at the end
end

jsfile = sepbuffer'\n'
wwwfile['all.js.cat'] = function()
	return jsfile() .. ' inline.js' --append inline code at the end
end

css = sepbuffer'\n'
wwwfile['inline.css'] = function()
	return css()
end

js = sepbuffer';\n'
wwwfile['inline.js'] = function()
	return js()
end

jsfile[[
glue.js
divs.js
webb_spa.js
mustache.js
config.js   // dynamic config
strings.js  // strings in current language
]]

--format js and css refs as separate refs or as a single ref based on a .cat action

local function jslist(cataction, mode)
	if mode == 'bundle' then
		out(string.format('	<script src="%s"></script>', lang_url('/'..cataction)))
	elseif mode == 'embed' then
		out'<script>'
		catlist(cataction..'.cat')
		out'</script>\n'
	elseif mode == 'separate' then
		for i,file in ipairs(catlist_files(wwwfile(cataction..'.cat'))) do
			out(string.format('	<script src="%s"></script>\n', lang_url('/'..file)))
		end
	else
		assert(false)
	end
end

local function csslist(cataction, mode)
	if mode == 'bundle' then
		out(string.format('	<link rel="stylesheet" type="text/css" href="/%s">', cataction))
	elseif mode == 'embed' then
		out'<style>'
		catlist(cataction..'.cat')
		out'</style>\n'
	elseif mode == 'separate' then
		for i,file in ipairs(catlist_files(wwwfile(cataction..'.cat'))) do
			out(string.format('	<link rel="stylesheet" type="text/css" href="%s">\n', lang_url('/'..file)))
		end
	else
		assert(false)
	end
end

--main template gluing it all together

local spa_template = [[
<!DOCTYPE html>
<html lang="{{lang}}">
<head>
	<meta charset=utf-8>
	<title>{{title}}{{title_suffix}}</title>
{{{all_js}}}
{{{all_css}}}
{{{head}}}
	<script>
		var client_action = {{client_action}}
	</{{undefined}}script>
</head>
<body opensans>
	<div style="display: none;">{{{templates}}}</div>
{{{body}}}
</body>
</html>
]]

function page_title(title, body)
	return title
		--infer it from the top heading
		or (body and body:match'<h1[^>]*>(.-)</h1>')
		--infer it from the name of the action
		or args(1):gsub('[-_]', ' ')
end

function spa(p)
	local t = {}
	t.lang = lang()
	t.body = filter_lang(p.body, lang())
	t.head = p.head
	t.title = page_title(p.title, t.body)
	t.title_suffix = config('page_title_suffix', ' - '..host())
	t.client_action = p.client_action or false
	t.all_js  = record(jslist , 'all.js' , p.js_mode  or config('js_mode' , 'separate'))
	t.all_css = record(csslist, 'all.css', p.css_mode or config('css_mode', 'separate'))
	local buf = stringbuffer()
	for _,name in ipairs(template()) do
		buf(mustache_wrap(template(name), name))
	end
	t.templates = buf()
	out(render_string(spa_template, t))
end