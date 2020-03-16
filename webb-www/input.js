/*
	Input-type widgets.
	Written by Cosmin Apreutesei. Public Domain.

*/

function input(...options) {

	let e = {}

	function init() {
		update(e, ...options)

		e.tooltip = H.span({class: 'input-error'})
		e.input = H.input({
			class: 'input',
		})
		e.view = H.div({class: 'input-view '+(e.class || '')}, e.input, e.tooltip)

		init_value()

		if (e.parent)
			e.parent.add(e.view)

		e.input.on('input', value_changed)
	}

	function init_value() {
		function get_value() {
			return this.input.value
		}
		function set_value(v) {
			this.input.value = v
		}
		let v = e.value
		delete e.value
		property(e, 'value', {get: get_value, set: set_value})
		if (v !== undefined)
			e.value = v
	}

	function value_changed(event) {
		let err = e.validate(e.value)
		e.invalid = err != true
		e.input.class('invalid', e.invalid)
		e.error = e.invalid && err || ''
		e.tooltip.innerHTML = e.error
		e.tooltip.style.display = e.error ? 'inherit' : 'none'
		if (e.invalid)
			event.stopImmediatePropagation()
	}

	e.validate = function(v) {
		return true
	}

	init()

	return e
}

