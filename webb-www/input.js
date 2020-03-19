/*
	Input-type widgets.
	Written by Cosmin Apreutesei. Public Domain.

*/

input = component('x-input', function(e, ...options) {

	function init() {
		create_view()
		update(e, ...options)
	}

	function get_value() {
		return this.input.value
	}

	function set_value(v) {
		this.input.value = v
	}

	property(e, 'value', {get: get_value, set: set_value})

	// view

	function create_view() {
		e.class('x-input', true)
		e.tooltip = H.span({class: 'x-input-error'})
		e.input = H.input({
			class: 'x-input-input',
		})
		e.input.on('input', value_changed)
		e.add(e.input, e.tooltip)
	}

	function value_changed() {
		let err = e.validate(e.value)
		e.invalid = err != true
		e.input.class('x-input-invalid', e.invalid)
		e.error = e.invalid && err || ''
		e.tooltip.innerHTML = e.error
		e.tooltip.style.display = e.error ? 'inherit' : 'none'
		if (e.invalid)
			return false
	}

	e.validate = function(v) {
		return true
	}

	init()

})

spin_input = component('x-spin-input', input, function(e) {
	e.class('x-spin-input', true)

	function init() {
		e.spin_up   = H.div({class: 'x-spin-input-button'}, H.div({class: 'fa fa-caret-up'}))
		e.spin_down = H.div({class: 'x-spin-input-button'}, H.div({class: 'fa fa-caret-down'}))
		e.spin_div = H.span({class: 'x-spin-input-button-div'}, e.spin_up, e.spin_down)
		e.add(e.spin_div)
	}

	init()

})
