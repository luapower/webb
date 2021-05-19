/*

	webb.js | single-page apps | client-side API
	Written by Cosmin Apreutesei. Public Domain.

CONFIG API

	config(name[, default]) -> value       for global config options
	S(name[, default]) -> s                for internationalized strings
	lang()                                 current language

ACTIONS

	lang_url([path[, params[, lang]]]) -> url  traslate a URL
	e.setlink([path[, params]])            hook an action to a link
	e.setlinks([filter])                   hook actions to all links
	page_loading() -> t|f                  was current page loaded or exec()'ed?
	exec(path[, params])                   change the window URL
	back()                                 go back to last URL in history
	setscroll([top])                       set scroll to last position or reset
	settitle([title])                      set title to <h1> contents or arg
	^url_changed                           url changed event
	^action_not_found                      action not found event
	action: {action: handler}
	intarg(s)
	optarg(s)
	slug(id, s)

TEMPLATES

	template(name) -> s                    get a template
	render_string(s, [data]) -> s          render a template from a string
	render(name, [data]) -> s              render a template
	e.render_string(s, data)               render template string to target
	e.render(name, [data])                 render template to target
	^bind(on, [data])                      fired before & after render

*/

{ // module scope.

// config --------------------------------------------------------------------

// some of the values come from the server (see config.js action).
{
let t = {}
function config(name, val) {
	if (val && !t[name])
		t[name] = val
	if (typeof(t[name]) == 'undefined')
		console.log('warning: missing config value for ', name)
	return t[name]
}}

// global S() for internationalizing strings.
{
let t = {}
function S(name, val) {
	if (val && !t[name])
		t[name] = val
	return t[name]
}}

function lang() {
	return document.documentElement.lang
}

// actions -------------------------------------------------------------------

let action_name = function(action) {
	return action.replaceAll('-', '_')
}

let action_urlname = function(action) {
	return action.replaceAll('_', '-')
}

let decode_url = function(path, params) {
	if (typeof path == 'string') {
		let t = url(path)
		if (params)
			for (k in params)
				if (params.hasOwnProperty(k))
					t.params[k] = params[k]
		return t
	} else {
		return {path: path, params: params || {}}
	}
}

// extract the action from a decoded url
let url_action = function(t) {
	if (t.path[0] == '' && t.path.length >= 2)
		return action_name(t.path[1])
}

// given an url (in encoded or decoded form), if it's an action url,
// replace its action name with a language-specific alias for a given
// (or current) language if any, or add ?lang= if the given language
// is not the default language.
function lang_url(path, params, target_lang) {
	let t = decode_url(path, params)
	let default_lang = config('lang')
	target_lang = target_lang || t.params.lang || lang()
	let action = url_action(t)
	if (action === undefined)
		return url(t)
	let is_root = t.path[1] == ''
	if (is_root)
		action = action_name(config('root_action'))
	let at = config('aliases').to_lang[action]
	let lang_action = at && at[target_lang]
	if (lang_action) {
		if (!(is_root && target_lang == default_lang))
			t.path[1] = lang_action
	} else if (target_lang != default_lang) {
		t.params.lang = target_lang
	}
	t.path[1] = action_urlname(t.path[1])
	return url(t)
}

action = {} // {name->handler}

// given a path (in encoded form), find its action and return the handler.
let action_handler = function(path) {
	let t = url(path)
	let act = url_action(t)
	if (act === undefined)
		return
	if (act == '')
		act = config('root_action')
	else // an alias or the act name directly
		act = config('aliases').to_en[act] || act
	act = action_name(act)
	let handler = action[act] // find a handler
	if (!handler) {
		// no handler, find a static template with the same name
		// to be rendered on the #main element.
		if (template(act)) {
			handler = function() {
				if (window.main)
					window.main.render(act)
			}
		}
	}
	if (!handler)
		return
	let args = t.path
	args.shift() // remove /
	args.shift() // remove act
	return function() {
		handler.apply(null, args)
	}
}

let loading = true

// check if the action was triggered by a page load or by exec()
function page_loading() {
	return loading
}

let ignore_url_changed

let url_changed = function() {
	if (ignore_url_changed)
		return
	document.fire('url_changed')
	let handler = action_handler(location.pathname)
	if (handler)
		handler()
	else
		document.fire('action_not_found')
	document.fire('after_exec')
}

document.on('action_not_found', function() {
	if (location.pathname != '/')
		exec('/')
})

function _save_scroll_state(top) {
	let state = history.state
	if (!state)
		return
	ignore_url_changed = true
	history.replaceState({top: top}, state.title, state.url)
	ignore_url_changed = false
}

let exec_aborted

let abort_exec = function() {
	exec_aborted = true
}

let check_exec = function() {
	exec_aborted = false
	document.fire('before_exec', abort_exec)
	return !exec_aborted
}

function exec(path, params) {
	if (!check_exec())
		return
	// store current scroll top in current state first
	_save_scroll_state(window.scrollY)
	// push new state without data
	history.pushState(null, null, lang_url(path, params))
}

function back() {
	if (!check_exec())
		return
	history.back()
}

// set scroll back to where it was or reset it
function setscroll(top) {
	if (top !== undefined) {
		_save_scroll_state(top)
	} else {
		let state = history.state
		if (!state)
			return
		let top = state.data && state.data.top || 0
	}
	window.scrollY = top
}

method(Element, 'setlink', function(path, params) {
	if (this.attr('_hooked'))
		return
	if (this.attr('target'))
		return
	path = path || this.attr('href')
	if (!path)
		return
	let url = lang_url(path, params)
	this.attr('href', url)
	let handler = action_handler(url)
	if (!handler)
		return
	this.on('click', function(event) {
		// shit/ctrl+click passes through to open in new window or tab
		if (event.shiftKey || event.ctrlKey)
			return
		event.preventDefault()
		exec(path, params)
	})
	this.attr('_hooked', true)
	return this
})

method(Element, 'setlinks', function(selector) {
	this.$(selector || 'a[href],area[href]').setlink()
	return this
})

function settitle(title) {
	title = title
		|| $('h1').html()
		|| url(location.pathname).path[1].replace(/[-_]/g, ' ')
	if (title)
		document.title = title + config('page_title_suffix')
}

function slug(id, s) {
	return (s.upper()
		.replace(/ /g,'-')
		.replace(/[^\w-]+/g,'')
	) + '-' + id
}

function intarg(s) {
	s = s && s.match(/\d+$/)
	return s && num(s) || ''
}

function optarg(s) {
	return s && ('/' + s) || ''
}

// templates -----------------------------------------------------------------

let load_templates = function(success) {
	ajax({
		url: '/'+config('templates_action'),
		success: function(s) {
			__templates.html = s
			success()
		},
		fail: function() {
			assert(false, 'could not load templates')
		},
	})
}

function template(name) {
	let e = window[name.replaceAll('-', '_')+'_template']
	return e && e.html
}

function render_string(s, data) {
	return Mustache.render(s, data || {}, template)
}

function render(template_name, data) {
	let s = template(template_name)
	return render_string(s, data)
}

method(Element, 'render_string', function(s, data) {
	this.fire('bind', false)
	this.html = render_string(s, data)
	this.fire('bind', true, data)
})

method(Element, 'render', function(name, data) {
	return this.render_string(template(name), data)
})

// init ----------------------------------------------------------------------

on_dom_load(function() {
	load_templates(function() {
		window.on('popstate', function(ev) {
			print('popstate', ev)
			loading = false
			url_changed()
		})
		if (client_action) // set from server.
			url_changed()
	})
})

} // module scope.
