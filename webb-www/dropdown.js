/*
	Dropdown Widget.
	Written by Cosmin Apreutesei. Public Domain.

	--

*/

function dropdown(...options) {

	var g = {
		//
	}

	var d
	var fields

	function init() {

		// set options/override.
		update(g, ...options)

		d = g.dataset

		// bind events
		d.on('reload', g.render)
		d.on('changed', g.changed)

		// render
		g.render()

		// focus the first cell
		g.move_focus(0, 0)
	}

	// rendering --------------------------------------------------------------


	init()
	return g

}
