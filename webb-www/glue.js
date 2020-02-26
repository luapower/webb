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

floor = Math.floor
ceil = Math.ceil
abs = Math.abs
min = Math.min
max = Math.max

function clamp(x, x0, x1) {
	return min(max(x, x0), x1)
}

function sign(x) {
	return x >= 0 ? 1 : -1
}

// callbacks -----------------------------------------------------------------

function noop() {}

function return_true() { return true; }

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

// extend an object with a property, checking for name clashes.
function property(cls, prop, descriptor) {
	var proto = cls.prototype || cls
	assert(!(prop in proto), '{0}.{1} already exists', cls.name, prop)
	Object.defineProperty(proto, prop, descriptor)
}

// extend an object with a method, checking for name clashes.
function method(cls, meth, func) {
	property(cls, meth, {
		value: func,
		enumerable: false,
	})
}

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

function getRecursivePropertyDescriptor(obj, key) {
	return Object.prototype.hasOwnProperty.call(obj, key)
		? Object.getOwnPropertyDescriptor(obj, key)
		: getRecursivePropertyDescriptor(Object.getPrototypeOf(obj), key)
}
method(Object, 'getPropertyDescriptor', function(key) {
	return key in this && getRecursivePropertyDescriptor(this, key)
})

function alias(cls, new_name, old_name) {
	var d = cls.prototype.getPropertyDescriptor(old_name)
	assert(d, '{0}.{1} does not exist', cls.name, old_name)
	Object.defineProperty(cls.prototype, new_name, d)
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
	for (arg of args)
		s = s.replace(RegExp('\\{' + arg + '\\}', 'gi'), arg)
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
