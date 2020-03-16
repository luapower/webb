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
random = Math.random

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
	let proto = cls.prototype || cls
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
	let inherited = cls.prototype[meth] || noop
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
	let d = cls.prototype.getPropertyDescriptor(old_name)
	assert(d, '{0}.{1} does not exist', cls.name, old_name)
	Object.defineProperty(cls.prototype, new_name, d)
}

// strings -------------------------------------------------------------------

// usage:
//		'{1} of {0}'.format(total, current)
//		'{1} of {0}'.format([total, current])
//		'{current} of {total}'.format({'current': current, 'total': total})

method(String, 'format', function(...args) {
	let s = this.toString()
	if (!args.length)
		return s
	if (isarray(args[0]))
		args = args[0]
	if (typeof(args[0]) == 'object')
		for (let k in args)
			s = s.replace(RegExp('\\{' + k + '\\}', 'gi'), args[k])
	else
		for (let i = 0; i < args.length; i++)
			s = s.replace(RegExp('\\{' + i + '\\}', 'gi'), args[i])
	return s
})

// arrays --------------------------------------------------------------------

isarray = Array.isArray

method(Array, 'insert', function(i, e) {
	this.splice(i, 0, e)
})

method(Array, 'remove', function(i) {
	let v = this[i]
	this.splice(i, 1)
	return v
})

method(Array, 'remove_value', function(v) {
	let i = this.indexoOf(v)
	if (i == -1) return
	this.splice(i, 1)
	return v
})

// hash maps -----------------------------------------------------------------

function keys(o, cmp) {
	let t = Object.getOwnPropertyNames(o)
	if (typeof sort == 'function')
		t.sort(cmp)
	else if (cmp)
		t.sort()
	return t
}

function update(target, ...sources) {
	for (let o of sources)
		if (o)
			for (let k of keys(o))
				target[k] = o[k]
  return target
}

// events --------------------------------------------------------------------

function install_events(o) {
	let obs = new Map()
	o.on = function(topic, handler) {
		if (!obs.has(topic))
			obs.set(topic, [])
		obs.get(topic).push(handler)
	}
	o.off = function(topic, handler) {
		obs.get(topic).remove_value(handler)
	}
	o.onoff = function(topic, handler, enable) {
		if (enable)
			o.on(topic, handler)
		else
			o.off(topic, handler)
	}
	o.trigger = function(topic, ...args) {
		var a = obs.get(topic)
		if (!a) return
		for (f of a)
			f.call(o, ...args)
	}
	return o
}

// timestamps ----------------------------------------------------------------

now = Date.now
utctime = Date.UTC

// get the time at the start of the day of a given time, plus/minus a number of days.
function day(t, offset) {
	let d = new Date(t)
	d.setMilliseconds(0)
	d.setSeconds(0)
	d.setMinutes(0)
	d.setHours(0)
	d.setDate(d.getDate() + (offset || 0))
	return d.valueOf()
}

// get the time at the start of the month of a given time, plus/minus a number of months.
function month(t, offset) {
	let d = new Date(t)
	d.setMilliseconds(0)
	d.setSeconds(0)
	d.setMinutes(0)
	d.setHours(0)
	d.setDate(1)
	d.setMonth(d.getMonth() + (offset || 0))
	return d.valueOf()
}

// get the time at the start of the year of a given time, plus/minus a number of years.
function year(t, offset) {
	let d = new Date(t)
	d.setMilliseconds(0)
	d.setSeconds(0)
	d.setMinutes(0)
	d.setHours(0)
	d.setDate(1)
	d.setMonth(1)
	d.setYear(d.getYear() + (offset || 0))
	return d.valueOf()
}

// get the time at the start of the week of a given time, plus/minus a number of weeks.
function week(t, offset) {
	let d = new Date(t)
	d.setMilliseconds(0)
	d.setSeconds(0)
	d.setMinutes(0)
	d.setHours(0)
	let days = -d.getDay() + week_start_offset()
	if (days > 0) days -= 7
	d.setDate(d.getDate() + days + (offset || 0) * 7)
	return d.valueOf()
}

function days(dt) {
	return dt / (3600 * 24 * 1000)
}

function year_of (t) { return (new Date(t)).getFullYear() }
function month_of(t) { return (new Date(t)).getMonth() }

locale = navigator.language

function weekday_name(t, how) {
	let d = new Date(t)
	return d.toLocaleDateString(locale, {weekday: how || 'short'})
}

function month_name(t, how) {
	let d = new Date(t)
	return d.toLocaleDateString(locale, {month: how || 'short'})
}

// no way to get OS locale in JS in 2020. I hate the web.
function week_start_offset() {
	return locale.startsWith('en') ? 0 : 1
}

// serialization -------------------------------------------------------------

json = JSON.stringify
