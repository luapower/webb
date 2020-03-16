/*
	Button Widget.
	Written by Cosmin Apreutesei. Public Domain.

*/

function button(...options) {

	let b = {}

	function init() {
		update(b, ...options)
		create()
	}

	function create() {
		b.button = H.button({class: 'button'}, b.title)
		if (b.parent)
			b.parent.add(b.button)
		b.button.class('primary', b.primary == true)
		b.button.on('click', b.click)
	}

	init()

	return b

}

