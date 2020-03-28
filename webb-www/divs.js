/*

	DOM manipulation & extensions.
	Written by Cosmin Apreutesei. Public Domain.

*/

// element attribute map manipulation ----------------------------------------

alias(Element, 'hasattr', 'hasAttribute')

method(Element, 'attr', function(k, v) {
	if (v === undefined)
		return this.getAttribute(k)
	else if (v == null)
		this.removeAttribute(k)
	else
		this.setAttribute(k, v)
	return this
})

property(Element, 'attrs', {
	get: function() {
		return this.attributes
	},
	set: function(attrs) { // doesn't remove existing attrs.
		if (attrs)
			for (let k in attrs)
				this.attr(k, attrs[k])
		return this
	}
})

// setting a default value for an attribute if one wasn't set in html.
method(Element, 'attrval', function(k, v) {
	if (!this.hasAttribute(k))
		this.setAttribute(k, v)
})

// element css class list manipulation ---------------------------------------

method(Element, 'class', function(name, enable) {
	if (enable !== false)
		this.classList.add(name)
	else
		this.classList.remove(name)
	return this
})

method(Element, 'hasclass', function(name) {
	return this.classList.contains(name)
})

method(Element, 'replace_class', function(s1, s2, normal) {
	this.class(s1, normal == false)
	this.class(s2, normal != false)
})


property(Element, 'classes', {
	get: function() {
		return this.attr('class')
	},
	set: function(s) { // doesn't remove existing classes.
		if (s)
			for (s of s.split(/\s+/))
				this.class(s, true)
	}
})

/*
function css(classname, prop) {
	let div = H.div({class: classname, style: 'position: absolute; visibility: hidden'})
	document.children[0].appendChild(div)
	let v = getComputedStyle(div)[prop]
	document.children[0].removeChild(div)
	return v
}
*/

// dom tree navigation for elements, skipping text nodes ---------------------

alias(Element, 'at'     , 'children')
alias(Element, 'parent' , 'parentNode')
alias(Element, 'first'  , 'firstElementChild')
alias(Element, 'last'   , 'lastElementChild')
alias(Element, 'next'   , 'nextElementSibling')
alias(Element, 'prev'   , 'previousElementSibling')

{
let indexOf = Array.prototype.indexOf
property(Element, 'index', { get: function() {
	return indexOf.call(this.parentNode.children, this)
}})
}

// dom tree querying & element list manipulation -----------------------------

alias(Element, '$', 'querySelectorAll')
alias(DocumentFragment, '$', 'querySelectorAll')
function $(s) { return document.querySelectorAll(s) }

function E(s) {
	return typeof(s) == 'string' ? document.querySelectorAll(s)[0] : s
}

// dom tree manipulation -----------------------------------------------------

method(Element, 'add', function(...args) {
	for (let e of args)
		if (e != null)
			this.append(e)
	return this
})

method(Element, 'insert', function(i0, ...args) {
	for (let i = args.length-1; i >= 0; i--) {
		let e = args[i]
		if (e != null)
			this.insertBefore(e, this.at[i0])
	}
	return this
})

method(Element, 'replace', function(i, e) {
	let e0 = this.at[i]
	if (e0 != null)
		this.replaceChild(e, e0)
	else if (e != null)
		this.append(e)
	return this
})

method(Element, 'clear', function() {
	this.innerHTML = null
	return this
})

alias(Element, 'html', 'innerHTML')

// creating html elements ----------------------------------------------------

// create a text node from a string, quoting it automatically.
function T(s) {
	return typeof(s) == 'string' ? document.createTextNode(s) : s
}

// create a html element from a html string.
// if the string contains more than one element or text node, wrap them in a span.
function H(s) {
	if (typeof(s) != 'string') // pass-through nulls and elements
		return s
	var span = H.span(0)
	span.html = s.trim()
	return span.childNodes.length > 1 ? span : span.firstChild
}

// create a HTML element from an attribute map and a list of child elements or text.
function tag(tag, attrs, ...children) {
	let e = document.createElement(tag)
	e.attrs = attrs
	if (children)
		e.add(...children)
	return e
}

['div', 'span', 'button', 'input', 'textarea', 'table', 'thead',
'tbody', 'tr', 'td', 'th', 'a', 'i', 'b', 'hr',
'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(function(s) {
	H[s] = function(...a) { return tag(s, ...a) }
})

// easy custom events & event wrappers ---------------------------------------

{
let callers = {}

function passthrough_caller(e, f) {
	if (typeof(e.detail) == 'object' && e.detail.args)
		return f.call(this, ...e.detail.args, e)
	else
		return f.call(this, e)
}

callers.click = function(e, f) {
	if (e.which == 1)
		return f.call(this, e)
	else if (e.which == 3)
		return this.fire('rightclick', e)
}

callers.mousedown = function(e, f) {
	if (e.which == 1)
		return f.call(this, e)
	else if (e.which == 3)
		return this.fire('rightmousedown', e)
}

callers.mouseup = function(e, f) {
	if (e.which == 1)
		return f.call(this, e)
	else if (e.which == 3)
		return this.fire('rightmouseup', e)
}

callers.mousemove = function(e, f) {
	return f.call(this, e.clientX, e.clientY, e)
}

callers.keydown = function(e, f) {
	return f.call(this, e.key, e.shiftKey, e.ctrlKey, e.altKey, e)
}
callers.keyup    = callers.keydown
callers.keypress = callers.keydown

callers.wheel = function(e, f) {
	if (e.deltaY)
		return f.call(this, e.deltaY, e)
}

let installers = {}

installers.resize = function(e) {
	let obs = e.__resize_observer
	if (!obs) {
		obs = new MutationObserver(function() {
			e.fire('resize')
		})
		obs.observe(e, {attributes: true})
		e.__resize_observer = obs
	}
}

let on = function(e, f) {
	let install = installers[e]
	if (install)
		install(e)
	if (e.starts('raw:')) { // raw handler
		e = e.slice(4)
		listener = f
	} else {
		let caller = callers[e] || passthrough_caller
		listener = function(e) {
			let ret = caller.call(this, e, f)
			if (ret === false) { // like jquery
				e.preventDefault()
				e.stopPropagation()
				e.stopImmediatePropagation()
				// notify document of stopped events.
				document.fire('stopped_event', e)
			}
		}
		f.listener = listener
	}
	this.addEventListener(e, listener)
	return this
}
method(Document, 'on', on)
method(Element, 'on', on)

let off = function(e, f) {
	this.removeEventListener(e, f.listener || f)
	return this
}
method(Document, 'off', off)
method(Element, 'off', off)

let onoff = function(e, f, enable) {
	if (enable)
		this.on(e, f)
	else
		this.off(e, f)
	return this
}
method(Document, 'onoff', onoff)
method(Element, 'onoff', onoff)

function fire(name, ...args) {
	let e = typeof(name) == 'string' ?
		new CustomEvent(name, {detail: {args}}) : name
	return this.dispatchEvent(e)
}
method(Document, 'fire', fire)
method(Element, 'fire', fire)
}

// geometry wrappers ---------------------------------------------------------

property(Element, 'x'    , { set: function(x) { this.style.left          = x + 'px'; } })
property(Element, 'y'    , { set: function(y) { this.style.top           = y + 'px'; } })
property(Element, 'w'    , { set: function(w) { this.style.width         = w + 'px'; } })
property(Element, 'h'    , { set: function(h) { this.style.height        = h + 'px'; } })
property(Element, 'min_w', { set: function(w) { this.style['min-width' ] = w + 'px'; } })
property(Element, 'min_h', { set: function(h) { this.style['min-height'] = h + 'px'; } })
property(Element, 'max_w', { set: function(w) { this.style['max-width' ] = w + 'px'; } })
property(Element, 'max_h', { set: function(h) { this.style['max-height'] = h + 'px'; } })

// common style wrappers -----------------------------------------------------

method(Element, 'show', function() { this.style.display = null })
method(Element, 'hide', function() { this.style.display = 'none' })

// common state wrappers -----------------------------------------------------

property(Element, 'focused', {get: function() {
	return document.activeElement == this
}})

method(Element, 'hasfocus', function() {
	return this.contains(document.activeElement)
})

// text editing --------------------------------------------------------------

alias(HTMLInputElement, 'select', 'setSelectionRange')

method(HTMLInputElement, 'set_input_filter', function() {
	function filter(e) {
		if (!this.input_filter || this.input_filter(this.value)) {
			this._valid_val  = this.value
			this._valid_sel1 = this.selectionStart
			this._valid_sel2 = this.selectionEnd
		} else {
			if (this._valid_val != null) {
				this.value = this._valid_val
				this.setSelectionRange(this._valid_sel1, this._valid_sel2)
			} else
				this.value = ''
			e.preventDefault()
			e.stopPropagation()
			e.stopImmediatePropagation()
		}
	}
	let events = ['input', 'keydown', 'keyup', 'mousedown', 'mouseup',
		'select', 'contextmenu', 'drop']
	for (e of events)
		this.on('raw:'+e, filter)
})

// scrolling -----------------------------------------------------------------

// box scroll-to-view box. from box2d.lua.
function scroll_to_view_rect(x, y, w, h, pw, ph, sx, sy) {
	let min_sx = -x
	let min_sy = -y
	let max_sx = -(x + w - pw)
	let max_sy = -(y + h - ph)
	return [
		min(max(sx, min_sx), max_sx),
		min(max(sy, min_sy), max_sy)
	]
}

method(Element, 'scroll_to_view_rect_offset', function(sx0, sy0, x, y, w, h) {
	let pw  = this.clientWidth
	let ph  = this.clientHeight
	sx0 = or(sx0, this.scrollLeft)
	sy0 = or(sy0, this.scrollTop )
	let [sx, sy] = scroll_to_view_rect(x, y, w, h, pw, ph, -sx0, -sy0)
	return [-sx, -sy]
})

// scroll to make inside rectangle invisible.
method(Element, 'scroll_to_view_rect', function(sx0, sy0, x, y, w, h) {
	this.scroll(...this.scroll_to_view_rect_offset(sx0, sy0, x, y, w, h))
})

method(Element, 'make_visible_scroll_offset', function(sx0, sy0) {
	let x = this.offsetLeft
	let y = this.offsetTop
	let w = this.offsetWidth
	let h = this.offsetHeight
	return this.parent.scroll_to_view_rect_offset(sx0, sy0, x, y, w, h)
})

// scroll parent to make self visible.
method(Element, 'make_visible', function() {
	this.parent.scroll(...this.make_visible_scroll_offset())
})

// creating & setting up web components --------------------------------------

// NOTE: the only reason for using this web components "technology" instead
// of creating normal elements is because of connectedCallback and
// disconnectedCallback for which there are no events in built-in elements.

HTMLElement.prototype.attach = noop
HTMLElement.prototype.detach = noop
HTMLElement.prototype.init   = noop

// component([[[tag], super_cls], super_tag], cons) -> create({option: value}) -> element.
function component(...args) {

	let tag, super_cls, super_tag, cons
	super_cls = HTMLElement
	if (typeof(args[0]) == 'string') { tag = args.shift(); }
	if (typeof(args[0]) == 'function' && args[1]) { super_cls = args.shift(); }
	if (typeof(args[0]) == 'string') { super_tag = args.shift(); }
	cons = args.shift()
	super_cls = super_cls.class || super_cls

	let cls = class extends super_cls {

		constructor(...args) {
			super()
			cons(this)

			// add user options, overriding any defaults and stub methods.
			// NOTE: this also calls any property setters, but some setters
			// cannot work on a partially configured object, so we defer
			// setting these properties to after init() runs (which is the
			// only reason for having a separate init() method at all).
			let init_later = {}
			this.__init_later = init_later
			update(this, ...args)

			// finish configuring the object, now that user options are in.
			this.init.call(this)

			// call the setters again, this time without the barrier.
			this.__init_later = null
			for (let k in init_later)
				this[k] = init_later[k]
		}

		connectedCallback() {
			if (this.isConnected)
				this.attach()
		}

		disconnectedCallback() {
			this.detach()
		}
	}

	customElements.define(tag, cls, { extends: super_tag })

	function make(...args) {
		return new cls(...args)
	}
	make.class = cls
	return make
}

method(HTMLElement, 'property', function(prop, getter, setter) {
	property(this, prop, {get: getter, set: setter})
})

// create a property which is guaranteed not to be set until after init() runs.
method(HTMLElement, 'late_property', function(prop, getter, setter) {
	setter_wrapper = setter && function(v) {
		let init_later = this.__init_later
		if (init_later)
			init_later[prop] = v // defer calling the actual setter.
		else
			setter.call(this, v)
	}
	property(this, prop, {get: getter, set: setter_wrapper})
})

/*

function noop_setter(v) {
	return v
}

// create a boolean property that sets or removes a css class.
method(HTMLElement, 'css_property', function(name, setter = noop_setter) {
	name = name.replace('_', '-')
	function get() {
		return this.hasclass(name)
	}
	function set(v) {
		if (!!v == this.hasclass(name))
			return
		setter.call(this, v)
		this.class(name, v)
	}
	this.late_property(name.replace('-', '_'), get, set)
})

// create a property that represents a html attribute.
// NOTE: a property `foo_bar` is created for an attribute `foo-bar`.
// NOTE: attr properties are not late properties so that their value
// can be available to init()!
method(HTMLElement, 'attr_property', function(name, default_val, setter = noop_setter, type) {
	name = name.replace('_', '-')
	function get() {
		if (this.hasAttribute(name))
			return this.getAttribute(name)
		else
			return default_val
	}
	if (type == 'bool') {
		function set(v) {
			setter.call(this, v)
			if (v)
				this.setAttribute(name, '')
			else
				this.removeAttribute(name)
		}
	} else {
		function set(v) {
			setter.call(this, v)
			this.setAttribute(name, v)
		}
	}
	this.property(name.replace('-', '_'), get, set)
})

method(HTMLElement, 'bool_attr_property', function(name, default_val, setter) {
	this.attr_property(name, default_val, setter, 'bool')
})

*/
