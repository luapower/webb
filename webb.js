/*

	webb.js | client-side main module
	Written by Cosmin Apreutesei. Public Domain.

CONFIG API

	config(name[, default]) -> value       for global config options
	S(name[, default]) -> s                for internationalized strings
	lang()                                 current language

ACTIONS

	lang_url([path[, params[, lang]]]) -> url  traslate a URL
	find_action(path) -> handler | nil     find the client-side action for a path
	e.setlink([path[, params]])            hook an action to a link
	e.setlinks([filter])                   hook actions to all links
	page_loading() -> t|f                  was current page loaded or exec()'ed?
	url_changed()                          window's URL changed
	exec(path[, params])                   change the window URL
	back()                                 go back to last URL in history
	setscroll([top])                       set scroll to last position or reset
	settitle([title])                      set title to <h1> contents or arg
	^url_changed                           url changed event
	^action_not_found                      action not found event
	action: {action: handler}

ARG VALIDATION

	intarg(s)
	optarg(s)
	slug(id, s)

TEMPLATES

	load_templates(success)                load templates from the server
	template(name) -> s                    get a template
	render_string(s, [data]) -> s          render a template from a string
	render(name, [data]) -> s              render a template
	e.render_string(s, data)               render template string to target
	e.render(name, [data])                 render template to target
	^bind(on, [data])                      fired before & after render

*/

// config --------------------------------------------------------------------

// some of the values come from the server (see config.js action).
var C_ = {}
function config(name, val) {
	if (val && !C_[name])
		C_[name] = val
	if (typeof(C_[name]) === 'undefined')
		console.log('warning: missing config value for ', name)
	return C_[name]
}

// global S() for internationalizing strings.
var S_ = {}
function S(name, val) {
	if (val && !S_[name])
		S_[name] = val
	return S_[name]
}

function lang() {
	return document.documentElement.lang
}

// actions/encoding ----------------------------------------------------------

function _action_name(action) {
	return action.replaceAll('-', '_')
}

function _action_urlname(action) {
	return action.replaceAll('_', '-')
}

function _decode_url(path, params) {
	if (typeof path == 'string') {
		var t = url(path)
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
function _url_action(t) {
	if (t.path[0] == '' && t.path.length >= 2)
		return _action_name(t.path[1])
}

// given an url (in encoded or decoded form), if it's an action url,
// replace its action name with a language-specific alias for a given
// (or current) language if any, or add ?lang= if the given language
// is not the default language.
function lang_url(path, params, target_lang) {
	var t = _decode_url(path, params)
	var default_lang = config('lang')
	var target_lang = target_lang || t.params.lang || lang()
	var action = _url_action(t)
	if (action === undefined)
		return url(t)
	var is_root = t.path[1] == ''
	if (is_root)
		action = _action_name(config('root_action'))
	var at = config('aliases').to_lang[action]
	var lang_action = at && at[target_lang]
	if (lang_action) {
		if (!(is_root && target_lang == default_lang))
			t.path[1] = lang_action
	} else if (target_lang != default_lang) {
		t.params.lang = target_lang
	}
	t.path[1] = _action_urlname(t.path[1])
	return url(t)
}

var action = {} // {action: handler}

// given a path (in encoded form), find the action it points to
// and return its handler.
function find_action(path) {
	var t = url(path)
	var act = _url_action(t)
	if (act === undefined)
		return
	if (act == '')
		act = config('root_action')
	else // an alias or the act name directly
		act = config('aliases').to_en[act] || act
	act = _action_name(act)
	var handler = action[act] // find a handler
	if (!handler) {
		// no handler, find a static template
		if (template(act) !== undefined) {
			handler = function() {
				render(act, null, '#main')
			}
		}
	}
	if (!handler)
		return
	var args = t.path
	args.shift(0) // remove /
	args.shift(0) // remove act
	return function() {
		handler.apply(null, args)
	}
}

// actions/history -----------------------------------------------------------

function check(truth) {
	if(!truth)
		document.fire('action_not_found')
}

var g_page_loading = true

// check if the action was triggered by a page load or by exec()
function page_loading() {
	return g_page_loading
}

on_dom_load(function() {
	window.on('popstate', function(ev) {
		print('popstate', ev)
		g_page_loading = false
		url_changed()
	})
})

var g_ignore_url_changed

function url_changed() {
	if (g_ignore_url_changed) return
	document.fire('url_changed')
	var handler = find_action(location.pathname)
	if (handler)
		handler()
	else
		check(false)
	document.fire('after_exec')
}

document.on('url_changed', function() {
	document.off('.current_action')
	off('.current_action')
})

function _save_scroll_state(top) {
	var state = History.getState()
	g_ignore_url_changed = true
	History.replaceState({top: top}, state.title, state.url)
	g_ignore_url_changed = false
}

var exec, back
(function() {

	var aborted

	function abort_exec() {
		aborted = true
	}

	function check_exec() {
		aborted = false
		document.fire('before_exec', [abort_exec])
		return !aborted
	}

	exec = function(path, params) {
		if (!check_exec())
			return
		// store current scroll top in current state first
		_save_scroll_state(window.scrollTop())
		// push new state without data
		History.pushState(null, null, lang_url(path, params))
	}

	back = function() {
		if (!check_exec())
			return
		History.back()
	}

})()

// set scroll back to where it was or reset it
function setscroll(top) {
	if (top !== undefined) {
		_save_scroll_state(top)
	} else {
		var state = History.getState()
		var top = state.data && state.data.top || 0
	}
	window.scrollTop(top)
}

method(Element, 'setlink', function(path, params) {
	this.each(function() {
		var a = this
		if (a.data('hooked_'))
			return
		if (a.attr('target'))
			return
		var path = path || a.attr('href')
		if (!path)
			return
		var url = lang_url(path, params)
		a.attr('href', url)
		var handler = find_action(url)
		if (!handler)
			return
		a.click(function(event) {
			// shit/ctrl+click passes through to open in new window or tab
			if (event.shiftKey || event.ctrlKey) return
			event.preventDefault()
			exec(path, params)
		}).data('hooked_', true)
	})
	return this
})

method(Element, 'setlinks', function(filter) {
	this.find(filter || 'a[href],area[href]').setlink()
	return this
})

function settitle(title) {
	title = title
		|| $('h1').html()
		|| url(location.pathname).path[1].replace(/[-_]/g, ' ')
	if (title)
		document.title = title + config('page_title_suffix')
}

// address bar, links and scrolling ------------------------------------------

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

function load_templates(success) {
	ajax({
		url: '/'+config('templates_action'),
		success: function(s) {
			__templates.html = s
			if (success)
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
	s = render_string(s, data)
	return this.fire('bind', false).set(s).fire('bind', true, data)
})

method(Element, 'render', function(name, data) {
	return this.render_string(template(name), data)
})

// init ----------------------------------------------------------------------

on_dom_load(function() {
	load_templates(function() {
		if (client_action)
			url_changed()
	})
})
