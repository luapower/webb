/*



*/

// dom manipulation ----------------------------------------------------------

// dom querying

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

function css(classname, prop) {
	let div = H.div({class: classname, style: 'position: absolute; visibility: hidden'})
	document.children[0].appendChild(div)
	let v = getComputedStyle(div)[prop]
	document.children[0].removeChild(div)
	return v
}

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
	if (typeof(attrs) == 'string') {
		e.attr('class', attrs)
	} else if (attrs)
		e.attrs(attrs)
	if (children)
		e.add(...children)
	return e
}

['div', 'span', 'button', 'input', 'textarea', 'table', 'thead',
'tbody', 'tr', 'td', 'th', 'a', 'i', 'b', 'hr'].forEach(function(s) {
	H[s] = function(...a) { return H(s, ...a) }
})

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

// geometry

property(Element, 'x'    , { set: function(x) { this.style.left      = x + 'px'; } })
property(Element, 'y'    , { set: function(y) { this.style.top       = y + 'px'; } })
property(Element, 'w'    , { set: function(w) { this.style.width     = w + 'px'; } })
property(Element, 'h'    , { set: function(h) { this.style.height    = h + 'px'; } })
property(Element, 'min_w', { set: function(w) { this.style.minWidth  = w + 'px'; } })
property(Element, 'min_h', { set: function(h) { this.style.minHeight = h + 'px'; } })
property(Element, 'max_w', { set: function(w) { this.style.maxWidth  = w + 'px'; } })
property(Element, 'max_h', { set: function(h) { this.style.maxHeight = h + 'px'; } })

// text editing --------------------------------------------------------------

alias(HTMLInputElement, 'caret', 'selectionStart')
alias(HTMLInputElement, 'select', 'setSelectionRange')

// scrolling -----------------------------------------------------------------

method(Element, 'scrollintoview', function() {
	let r = this.getBoundingClientRect()
	if (r.top < 0 || r.left < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth)
		this.scrollIntoView(r.top < 0)
})
