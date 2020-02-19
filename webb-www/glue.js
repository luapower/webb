
// math ----------------------------------------------------------------------

function clamp(x, x0, x1) {
	return Math.min(Math.max(x, x0), x1)
}

function sign(x) {
	return x > 0 ? 1 : x < 0 ? -1 : 0
}

// error handling ------------------------------------------------------------

function assert(t, err) {
	if (t == null || t === false || t === undefined)
		throw (err || 'assertion failed')
	return t
}

// arrays --------------------------------------------------------------------

function insert(a, i, e) {
	a.splice(i, 0, e)
}

function remove(a, i) {
	var v = a[i]
	a.splice(i, 1)
	return v
}

// hash maps -----------------------------------------------------------------

function update(target) {
	for (var i = 1; i < arguments.length; i++)
		if (arguments[i])
			for (var key in arguments[i])
				target[key] = arguments[i][key]
  return target
}

// strings -------------------------------------------------------------------

// usage:
//		'{1} of {0}'.format(total, current)
//		'{1} of {0}'.format([total, current])
//		'{current} of {total}'.format({'current': current, 'total': total})
assert(!String.prototype.format)
String.prototype.format = function() {
	var s = this.toString()
	if (!arguments.length)
		return s
	var type1 = typeof arguments[0]
	var args = ((type1 == 'string' || type1 == 'number') ? arguments : arguments[0])
	for (arg in args)
		s = s.replace(RegExp('\\{' + arg + '\\}', 'gi'), args[arg])
	return s
}
