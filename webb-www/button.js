/*
	Button Widget.
	Written by Cosmin Apreutesei. Public Domain.

*/

button = component('x-button', HTMLButtonElement, 'button', function(e, t) {

	e.class('x-widget')
	e.class('x-button')

	function get_text() {
		return e.innerHTML
	}

	function set_text(s) {
		e.innerHTML = s
	}

	property(e, 'text', {get: get_text, set: set_text})

	class_property(e, 'primary')

	e.on('click', t.click)

})

