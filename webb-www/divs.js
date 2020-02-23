/*

	e.caret_pos -> i
	e.caret_pos = i

*/

// element tree ops ----------------------------------------------------------

function byid(id) {
	return document.getElementById(id)
}

method(Element, 'attr', function(k, v) {
	if (v == null)
		this.removeAttribute(k)
	else
		this.setAttribute(k, v)
	return this
})

method(Element, 'attrs', function(attrs) {
	if (attrs)
		for (var k in attrs)
			this.attr(k, attrs[k])
	return this
})

method(Element, 'add', function(...children) {
	for (var ce of children)
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

method(Element, 'set1', function(ce) {
	var c1 = this.firstChild
	if (c1)
		this.replaceChild(ce, c1)
	else
		this.appendChild(ce)
	return this
})

function H(tag, attrs, ...children) {
	var e = document.createElement(tag)
	if (attrs)
		e.attrs(attrs)
	if (children)
		e.add(...children)
	return e
}

function div      (...a) { return H('div'     , ...a) }
function span     (...a) { return H('span'    , ...a) }
function button   (...a) { return H('button'  , ...a) }
function input    (...a) { return H('input'   , ...a) }
function textarea (...a) { return H('textarea', ...a) }
function table    (...a) { return H('table'   , ...a) }
function tr       (...a) { return H('tr'      , ...a) }
function td       (...a) { return H('td'      , ...a) }
function th       (...a) { return H('th'      , ...a) }
function thead    (...a) { return H('thead'   , ...a) }
function tbody    (...a) { return H('tbody'   , ...a) }

// text-editables ------------------------------------------------------------

property(Element, 'caret_pos', {
	get: function() {
		if (target.contentEditable === 'true') {
			target.focus()
			var range1 = window.getSelection().getRangeAt(0)
			var range2 = range1.cloneRange()
			range2.selectNodeContents(target)
			range2.setEnd(range1.endContainer, range1.endOffset)
			return range2.toString().length
		} else {
			return target.selectionStart
		}
	},
	set: function(pos) {
		if (pos == -1) {
			pos = this[isContentEditable? 'text' : 'val']().length
		}
		if (isContentEditable) {
			target.focus()
			window.getSelection().collapse(target.firstChild, pos)
		} else { //textarea
			target.setSelectionRange(pos, pos)
		}
		if (!isContentEditable) {
			target.focus()
		}
		return pos
	}
})

