/*

	webb.js | single-page apps | client-side API
	Written by Cosmin Apreutesei. Public Domain.

CONFIG API

	config(name[, default]) -> value       for global config options
	S(name[, default]) -> s                for internationalized strings
	lang()                                 current language

ACTIONS

	lang_url(url, [lang]) -> url           traslate a URL
	e.setlink([url])                       hook an action to a link
	e.setlinks([filter])                   hook actions to all links
	page_loading() -> t|f                  was current page loaded or exec()'ed?
	exec(url)                              change the tab URL
	back()                                 go back to last URL in history
	setscroll([top])                       set scroll to last position or reset
	settitle([title])                      set title to <h1> contents or arg
	^url_changed                           url changed event
	^action_not_found                      action not found event
	action: {action: handler}
	id_arg(s)
	opt_arg(s)
	slug(id, s)

TEMPLATES

	template(name) -> s                    get a template
	render_string(s, [data]) -> s          render a template from a string
	render(name, [data]) -> s              render a template
	e.render_string(s, data)               render template string into e
	e.render([data])                       render e.template into e
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
		warn('missing config value for', name)
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

let decode_url = function(url_) {
	if (typeof url_ == 'string') {
		let t = url(url)
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
	if (t.segments[0] == '' && t.segments.length >= 2)
		return action_name(t.segments[1])
}

// given an url (in encoded or decoded form), if it's an action url,
// replace its action name with a language-specific alias for a given
// (or current) language if any, or add ?lang= if the given language
// is not the default language.
function lang_url(url_s, target_lang) {
	let t = url(url_s)
	let default_lang = config('lang')
	target_lang = target_lang || t.params.lang || lang()
	let action = url_action(t)
	if (action === undefined)
		return url(t)
	let is_root = t.segments[1] == ''
	if (is_root)
		action = action_name(config('root_action'))
	let at = config('aliases').to_lang[action]
	let lang_action = at && at[target_lang]
	if (lang_action) {
		if (!(is_root && target_lang == default_lang))
			t.segments[1] = lang_action
	} else if (target_lang != default_lang) {
		t.params.lang = target_lang
	}
	t.segments[1] = action_urlname(t.segments[1])
	return url(t)
}

action = {} // {name->handler}

// given a url (in encoded form), find its action and return the handler.
let action_handler = function(url_s) {
	let t = url(url_s)
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
		} else if (static_template(act)) {
			handler = function() {
				if (window.main)
					window.main.html = static_template(act)
			}
		}
	}
	if (!handler)
		return
	let args = t.segments
	args.shift() // remove /
	args.shift() // remove act
	return function() {
		handler.call(null, args, t.params, t.hash)
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
	let handler = action_handler(location.pathname + location.search + location.hash)
	if (handler)
		handler()
	else
		document.fire('action_not_found')
	document.fire('after_exec')
}

document.on('action_not_found', function() {
	if (location.pathname == '/')
		return // no home action
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

function exec(url) {
	if (!check_exec())
		return
	_save_scroll_state(window.scrollY)
	history.pushState(null, null, lang_url(url))
	window.fire('popstate')
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

method(Element, 'setlink', function(url) {
	if (this._hooked)
		return
	if (this.attr('target'))
		return
	url = url || this.attr('href')
	if (!url)
		return
	url = lang_url(url)
	this.attr('href', url)
	let handler = action_handler(url)
	if (!handler)
		return
	this.on('click', function(event) {
		// shit/ctrl+click passes through to open in new window or tab
		if (event.shiftKey || event.ctrlKey)
			return
		event.preventDefault()
		exec(url)
	})
	this._hooked = true
	return this
})

method(Element, 'setlinks', function(selector) {
	this.$(selector || 'a[href],area[href]').setlink()
	return this
})

function settitle(title) {
	title = title
		|| $('h1').html()
		|| url(location.pathname).segments[1].replace(/[-_]/g, ' ')
	if (title)
		document.title = title + config('page_title_suffix')
}

function slug(id, s) {
	return (s.upper()
		.replace(/ /g,'-')
		.replace(/[^\w-]+/g,'')
	) + '-' + id
}

function id_arg(s) {
	s = s && s.match(/\d+$/)
	return s && num(s) || ''
}

function opt_arg(s) {
	return s && ('/' + s) || ''
}

// templates -----------------------------------------------------------------

function template(name) {
	let e = window[name+'_template']
	return e && e.tag == 'script' ? e.html : null
}

function static_template(name) {
	let e = window[name+'_template']
	return e && e.tag == 'template' ? e.html : null
}

function render_string(s, data) {
	return Mustache.render(s, data || {}, template)
}

function render(template_name, data) {
	let s = template(template_name)
	return render_string(s, data)
}

method(Element, 'render_string', function(s, data, ev) {
	this.html = render_string(s, data)
	this.fire('render', data, ev)
})

method(Element, 'render', function(data, ev) {
	let s = this.template_string || template(this.template)
	this.render_string(s, data, ev)
})

// init ----------------------------------------------------------------------

on_dom_load('url_changed', function() {
	window.on('popstate', function(ev) {
		loading = false
		url_changed()
	})
	if (client_action) // set from server.
		url_changed()
})

} // module scope.
