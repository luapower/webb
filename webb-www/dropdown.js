/*
	Dropdown Widget.
	Written by Cosmin Apreutesei. Public Domain.

	--

*/

function dropdown(...options) {

	let e = {}

	function init() {
		update(e, ...options)

		e.value_td = H.td({class: 'dropdown-value'})
		e.view = H.table({
				class: 'dropdown '+(e.class || '')
			},
			H.tr({},
				e.value_td,
				H.td({
					class: 'dropdown-button fa fa-caret-down',
					valign: 'middle',
					width: 0,
				}, e.button)))

		init_value()

		if (e.picker)
			e.picker.on('pick_value', value_picked)

		e.view.on('click', view_click)

		if (e.parent)
			e.parent.add(e.view)

	}

	function init_value() {
		let value
		function get_value() {
			return value
		}
		function set_value(v) {
			value = v
			e.value_td.innerHTML = v
			if (e.dataset) {
				let err = e.dataset.set_value(v)
			}
		}
		let v = e.value
		delete e.value
		property(e, 'value', {get: get_value, set: set_value})
		if (v !== undefined)
			e.value = v
	}

	function value_picked(v) {
		e.value = v
	}

	e.open_picker = function() {
		if (!e.picker)
			return
		e.view.add(e.picker.view)
	}

	function view_click() {
		e.open_picker()
	}

	init()

	return e
}
