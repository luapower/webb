/*

	clamp(x, x0, x1)
	sign(x)

	s.format(fmt, ...)

	assert(ret, err, ...)

	a.insert(i, e)
	a.remove(i)

	keys(t, [cmp]) -> t
	update(t, [t1], ...) -> t

	json(v) -> s

*/

// math ----------------------------------------------------------------------

function clamp(x, x0, x1) {
	return Math.min(Math.max(x, x0), x1)
}

function sign(x) {
	return x > 0 ? 1 : x < 0 ? -1 : 0
}

// error handling ------------------------------------------------------------

print = console.log

function assert(ret, err, ...args) {
	if (ret == null || ret === false || ret === undefined) {
		console.trace()
		throw ((err && err.format(...args) || 'assertion failed'))
	}
	return ret
}

// objects -------------------------------------------------------------------

// extend an object with a method, checking for name clashes.
function method(cls, meth, func) {
	assert(!(meth in cls.prototype), '{0}.{1} already exists', cls.name, meth)
	Object.defineProperty(cls.prototype, meth, {
		value: func,
		enumerable: false,
	})
}

// extend an object with a property, checking for name clashes.
function property(cls, prop, gettersetter) {
	assert(!(prop in cls.prototype), '{0}.{1} already exists', cls.name, prop)
	Object.defineProperty(cls.prototype, prop, gettersetter)
}

function noop() {}

function override(cls, meth, func) {
	var inherited = cls.prototype[meth] || noop
	function wrapper(inherited, ...args) {
		return meth.apply(this, inherited, args)
	}
	Object.defineProperty(cls.prototype, wrapper, {
		value: func,
		enumerable: false,
	})
}

// strings -------------------------------------------------------------------

// usage:
//		'{1} of {0}'.format(total, current)
//		'{1} of {0}'.format([total, current])
//		'{current} of {total}'.format({'current': current, 'total': total})

method(String, 'format', function(...args) {
	var s = this.toString()
	if (!args.length)
		return s
	var type1 = typeof args[0]
	var args = ((type1 == 'string' || type1 == 'number') ? args : args[0])
	for (arg in args)
		s = s.replace(RegExp('\\{' + arg + '\\}', 'gi'), args[arg])
	return s
})

// arrays --------------------------------------------------------------------

var isarray = Array.isArray

method(Array, 'insert', function(i, e) {
	this.splice(i, 0, e)
})

method(Array, 'remove', function(i) {
	var v = this[i]
	this.splice(i, 1)
	return v
})

// hash maps -----------------------------------------------------------------

function keys(o, cmp) {
	var t = Object.getOwnPropertyNames(o)
	if (typeof sort == 'function')
		t.sort(cmp)
	else if (cmp)
		t.sort()
	return t
}

function update(target, ...sources) {
	for (var o of sources)
		if (o)
			for (var k of keys(o))
				target[k] = o[k]
  return target
}

// serialization -------------------------------------------------------------

json = JSON.stringify
