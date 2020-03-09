/*



*/

// dom manipulation ----------------------------------------------------------

// dom querying

function byid(id) { return document.getElementById(id) }

alias(Element, 'at'     , 'childNodes')
alias(Element, 'parent' , 'parentNode')
alias(Element, 'first'  , 'firstElementChild')
alias(Element, 'last'   , 'lastElementChild')
alias(Element, 'next'   , 'nextElementSibling')
alias(Element, 'prev'   , 'previousElementSibling')

let indexOf = Array.prototype.indexOf
property(Element, 'index', { get: function() {
	return indexOf.call(this.parentNode.childNodes, this)
}})

// element attributes

method(Element, 'attr', function(k, v) {
	if (v == null)
		this.removeAttribute(k)
	else
		this.setAttribute(k, v)
	return this
})

method(Element, 'attrs', function(attrs) {
	if (attrs)
		for (let k in attrs)
			this.attr(k, attrs[k])
	return this
})

// css styles & classes

method(Element, 'class', function(name, enable) {
	if (enable !== false)
		this.classList.add(name)
	else
		this.classList.remove(name)
})

method(Element, 'hasclass', function(name) {
	return this.classList.contains(name)
})

// tree ops

method(Element, 'add', function(...children) {
	for (let ce of children)
		if (isarray(ce)) {
			for (ce of ce)
				if (ce != null)
					this.append(ce)
		} else {
			if (ce != null)
				this.append(ce)
		}
	return this
})

method(Element, 'insert', function(i, e) {
	print(this.childNodes.length, i, this.childNodes[i].parentNode, this)
	this.insertBefore(e, this.childNodes[i])
})

method(Element, 'set1', function(ce) {
	let c1 = this.first
	if (c1)
		this.replaceChild(ce, c1)
	else
		this.appendChild(ce)
	return this
})

// creating elements

function H(tag, attrs, ...children) {
	let e = document.createElement(tag)
	if (attrs)
		e.attrs(attrs)
	if (children)
		e.add(...children)
	return e
}

H.div      = function(...a) { return H('div'     , ...a) }
H.span     = function(...a) { return H('span'    , ...a) }
H.button   = function(...a) { return H('button'  , ...a) }
H.input    = function(...a) { return H('input'   , ...a) }
H.textarea = function(...a) { return H('textarea', ...a) }
H.table    = function(...a) { return H('table'   , ...a) }
H.thead    = function(...a) { return H('thead'   , ...a) }
H.tbody    = function(...a) { return H('tbody'   , ...a) }
H.tr       = function(...a) { return H('tr'      , ...a) }
H.td       = function(...a) { return H('td'      , ...a) }
H.th       = function(...a) { return H('th'      , ...a) }
H.a        = function(...a) { return H('a'       , ...a) }
H.i        = function(...a) { return H('i'       , ...a) }
H.b        = function(...a) { return H('b'       , ...a) }

// events

{
	let on = function(e, f) {
		this.addEventListener(e, f)
		return this
	}
	method(Document, 'on', on)
	method(Element, 'on', on)

	let off = function(e, f) {
		this.removeEventListener(e, f)
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
}

// text editing --------------------------------------------------------------

alias(HTMLInputElement, 'caret', 'selectionStart')
alias(HTMLInputElement, 'select', 'setSelectionRange')

// scrolling -----------------------------------------------------------------

method(Element, 'scrollintoview', function() {
	let r = this.getBoundingClientRect()
	if (r.top < 0 || r.left < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth)
		this.scrollIntoView(r.top < 0)
})
