/*
	Grid/TreeList Widget.
	Written by Cosmin Apreutesei. Public Domain.

	--

*/

var active_grid // the grid that gets keyboard input

function grid(...options) {

	var g = {}

	var d
	var fields

	function init() {

		// set options/override.
		update(g, ...options)
		d = g.dataset

		fields = []
		if (g.cols)
			for (var fi of g.cols)
				fields.push(d.fields[fi])
		else
			fields = d.fields.slice()

		// bind events
		d.on('reload', function() {
			g.render()
		})

		// render
		g.render()

		// focus the first row
		g.focus_row()
	}

	// rendering --------------------------------------------------------------

	var grid_div, grid_table

	g.render = function() {

		g.focused_row = null
		g.selected_rows = new Set()

		assert(g.container)
		grid_table = table({class: 'grid'})
		var header_tr = tr()
		for (var field of fields) {
			var header_th = th({class: 'grid-header-col'}, field.name)
			header_tr.add(header_th)
		}
		grid_table.add(header_tr)
		for (var row of d.rows) {
			var row_tr = tr()
			for (var field of fields) {
				var cell_td = td({class: 'grid-cell'}, d.val(row, field.index))
				row_tr.add(cell_td)
			}
			grid_table.add(row_tr)
		}
		grid_div = div({class: 'grid-div'}, grid_table)
		g.container.set1(grid_div)
		g.start_moving_col(1)
	}

	// moving -----------------------------------------------------------------

	var move_table, place_td

	g.start_moving_col = function(col_index) {
		var col_td = grid_table.childNodes[0].childNodes[col_index]
		var pos = col_td.pos
		print(pos)
		move_table = div({class: 'grid grid-move-grid'})
		for (child_tr of grid_table.childNodes) {
			var cell = child_tr.childNodes[col_index]
			var move_tr = tr()
			move_tr.add(cell)
			move_table.add(move_tr)
		}
		grid_div.add(move_table)
		move_table.pos = pos
		print(move_table.pos)
		place_td = td({width: col_td.clientWidth, rowspan: d.rows.length + 1})
		grid_table.childNodes[0].insert(col_index, place_td)
		return move_table
	}

	g.stop_moving_col = function() {
		//
	}

	// navigation & selection -------------------------------------------------

	g.focus_row = function(row) {
		g.focused_row = row
	}

	g.move_down = function(rows) {

	}

	g.move_up = function(rows) {

	}

	// editing ----------------------------------------------------------------

	g.edit_cell = function() {

	}

	// re-arranging -----------------------------------------------------------

	g.move_col = function(ci, to_ci) {

	}

	g.move_row_after = function(row, after_row) {

	}

	g.start_drag_row = function() {

	}

	g.drop_row = function() {

	}

	g.cancel_drag_row = function() {

	}

	init()

	return g
}

