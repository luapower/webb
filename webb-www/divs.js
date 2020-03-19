/*

	DOM manipulation & extensions.
	Written by Cosmin Apreutesei. Public Domain.

*/

// element attribute map manipulation

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

// element css class list manipulation

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

property(Element, 'classes', {
	get: function() {
		return this.attr('class')
	},
	set: function(s) {
		this.attr('class', s)
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

// dom tree navigation for elements, skipping text nodes.

alias(Element, 'at'     , 'children')
alias(Element, 'parent' , 'parentNode')
alias(Element, 'first'  , 'firstElementChild')
alias(Element, 'last'   , 'lastElementChild')
alias(Element, 'next'   , 'nextElementSibling')
alias(Element, 'prev'   , 'previousElementSibling')

let indexOf = Array.prototype.indexOf
property(Element, 'index', { get: function() {
	return indexOf.call(this.parentNode.children, this)
}})

// dom tree manipulation.

function T(s) {
	return typeof(s) == 'string' ? document.createTextNode(s) : s
}

method(Element, 'add', function(...children) {
	for (let e of children)
		if (e != null)
			this.append(e)
	return this
})

method(Element, 'insert', function(i, e) {
	if (e == null)
		return
	this.insertBefore(e, this.at[i])
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

// creating elements & web components.

function H(tag, attrs, ...children) {
	let e = document.createElement(tag)
	e.attrs = attrs
	if (children)
		e.add(...children)
	return e
}

['div', 'span', 'button', 'input', 'textarea', 'table', 'thead',
'tbody', 'tr', 'td', 'th', 'a', 'i', 'b', 'hr'].forEach(function(s) {
	H[s] = function(...a) { return H(s, ...a) }
})

function component(...args) {
	let tag, super_cls, ext_tag, cons
	super_cls = HTMLElement
	if (typeof(args[0]) == 'string') { tag = args.shift(); }
	if (typeof(args[0]) == 'function' && args[1]) { super_cls = args.shift(); }
	if (typeof(args[0]) == 'string') { ext_tag = args.shift(); }
	cons = args.shift()
	super_cls = super_cls.class || super_cls
	let cls = class extends super_cls {
		constructor(...args) {
			super(...args)
			cons(this, ...args)
		}
		connectedCallback() {
			if (this.isConnected && ('attach' in this))
				this.attach()
		}
		disconnectedCallback() {
			if ('detach' in this)
				this.detach()
		}
	}
	customElements.define(tag, cls, { extends: ext_tag })
	function make(...options) {
		return new cls(...options)
	}
	make.class = cls
	return make
}

/*
function attribute(cls, name, type) {

	if (type == 'bool')
		property(cls, name, {
			get: function() { return this.hasAttribute(name) }
			set: function(v) {
				if (v)
					this.setAttribute(name, '')
				else
					this.removeAttribute(name)
			}
		})
	else
		property(cls, name, {
			get: function() { return this.getAttribute(name) }
			set: function(s) { this.setAttribute(name, s) }
		})


	cls = cls.prototype || cls

	array_attr(cls, '_observedAttributes').push(name)

	cls.attributeChangedCallback = function(name, v0, v1) {

		switch (name) {
    case 'value':
      console.log(`Value changed from ${oldValue} to ${newValue}`);
      break;
    case 'max':
      console.log(`You won't max-out any time soon, with ${newValue}!`);
      break;
  }
}
}
*/

// automating property creation.

function class_property(cls, name) {
	function get() {
		return this.hasclass(name)
	}
	function set(v) {
		this.class(name, v)
	}
	property(cls, name, {get, set})
}

// easy custom events & event wrappers.

method(Element, 'fire', function(name, ...args) {
	let e = typeof(name) == 'string' ?
		new CustomEvent(name, {detail: args}) : name
	return this.dispatchEvent(e)
})

{
	let callers = {}

	function passthrough_caller(e, f) {
		return f.call(this, ...e.detail)
	}

	function noop_caller(e, f) {
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

	callers.keydown = function(e, f) {
		return f.call(this, e.key, e.shiftKey, e.ctrKey, e.altKey, e)
	}
	callers.keyup    = callers.keydown
	callers.keypress = callers.keydown

	callers.wheel = function(e, f) {
		if (e.deltaY)
			return f.call(this, e.deltaY, e)
	}

	callers.input = noop_caller

	let on = function(e, f) {
		let listener
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
}

// geometry wrappers.

property(Element, 'x'    , { set: function(x) { this.style.left      = x + 'px'; } })
property(Element, 'y'    , { set: function(y) { this.style.top       = y + 'px'; } })
property(Element, 'w'    , { set: function(w) { this.style.width     = w + 'px'; } })
property(Element, 'h'    , { set: function(h) { this.style.height    = h + 'px'; } })
property(Element, 'min_w', { set: function(w) { this.style.minWidth  = w + 'px'; } })
property(Element, 'min_h', { set: function(h) { this.style.minHeight = h + 'px'; } })
property(Element, 'max_w', { set: function(w) { this.style.maxWidth  = w + 'px'; } })
property(Element, 'max_h', { set: function(h) { this.style.maxHeight = h + 'px'; } })

// text editing

alias(HTMLInputElement, 'caret', 'selectionStart')
alias(HTMLInputElement, 'select', 'setSelectionRange')

/*
// scrolling

method(Element, 'scrollintoview', function() {
	let r = this.getBoundingClientRect()
	if (r.top < 0 || r.left < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth)
		this.scrollIntoView(r.top < 0)
})
*/

// element resize event hack -------------------------------------------------

/*
(function(){
  var attachEvent = document.attachEvent;
  var isIE = navigator.userAgent.match(/Trident/);
  console.log(isIE);
  var requestFrame = (function(){
    var raf = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame ||
        function(fn){ return window.setTimeout(fn, 20); };
    return function(fn){ return raf(fn); };
  })();

  var cancelFrame = (function(){
    var cancel = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.webkitCancelAnimationFrame ||
           window.clearTimeout;
    return function(id){ return cancel(id); };
  })();

  function resizeListener(e){
    var win = e.target || e.srcElement;
    if (win.__resizeRAF__) cancelFrame(win.__resizeRAF__);
    win.__resizeRAF__ = requestFrame(function(){
      var trigger = win.__resizeTrigger__;
      trigger.__resizeListeners__.forEach(function(fn){
        fn.call(trigger, e);
      });
    });
  }

  function objectLoad(e){
    this.contentDocument.defaultView.__resizeTrigger__ = this.__resizeElement__;
    this.contentDocument.defaultView.addEventListener('resize', resizeListener);
  }

  window.addResizeListener = function(element, fn){
    if (!element.__resizeListeners__) {
      element.__resizeListeners__ = [];
      if (attachEvent) {
        element.__resizeTrigger__ = element;
        element.attachEvent('onresize', resizeListener);
      }
      else {
        if (getComputedStyle(element).position == 'static') element.style.position = 'relative';
        var obj = element.__resizeTrigger__ = document.createElement('object');
        obj.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; pointer-events: none; z-index: -1;');
        obj.__resizeElement__ = element;
        obj.onload = objectLoad;
        obj.type = 'text/html';
        if (isIE) element.appendChild(obj);
        obj.data = 'about:blank';
        if (!isIE) element.appendChild(obj);
      }
    }
    element.__resizeListeners__.push(fn);
  };

  window.removeResizeListener = function(element, fn){
    element.__resizeListeners__.splice(element.__resizeListeners__.indexOf(fn), 1);
    if (!element.__resizeListeners__.length) {
      if (attachEvent) element.detachEvent('onresize', resizeListener);
      else {
        element.__resizeTrigger__.contentDocument.defaultView.removeEventListener('resize', resizeListener);
        element.__resizeTrigger__ = !element.removeChild(element.__resizeTrigger__);
      }
    }
  }
})();

*/
