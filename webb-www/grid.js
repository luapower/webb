/*
	Grid/TreeList Widget.
	Written by Cosmin Apreutesei. Public Domain.

	--

*/

var active_grid // the grid that gets keyboard input

function grid(...options) {

	var g = {}

	var d

	function init() {

		// set options/override.
		update(g, ...options)

		// add missing state
		if (!g.cols) {
			g.cols = []
			for (fi in g.dataset.fields)
				g.cols.push(fi)
		}

		// init locals
		d = g.dataset

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

	g.render_header = function() {
		var cols_tr = tr()
		for (ci of g.cols) {
			var field = d.fields[ci]
			cols_tr.add(
				th({class: 'field'},
					field.fixed_width ?
					div({class: 'resizer_div'},
						div({class: 'resizer'})
					) : null,
					table({width: '100%', height: '100%', class: 'field_box'},
						tr(0,
							field.align == 'left' ? [
								td({class: 'nowrap', align: 'left', valign: 'bottom'},
									div({class: 'autohide'},
										a(0, field.name)
									)
								),
								td({class: 'nowrap', align: 'right', valign: 'bottom', width: '1'},
									a(0, i({class: 'sort_icon fa fa-sort'+field.sort}))
								)
							]: null,
						)
					)
				)
			)
		}
		return cols_tr
	}

	g.render_row = function(row) {
		var row_tr = tr({class: 'row'})
		row_tr.row = row
		for (fi of g.cols) {
			var field = d.fields[fi]
			var val = d.val(row, fi)
			row_tr.add(
				td({
						class: 'cell nowrap ' + field.readonly ? 'readonly' : '',
						align: field.align,
						valign: 'top',
					}, val
				)
			)
		}
		return row_tr
	}

	g.render = function() {

		g.focused_row = null
		g.selected_rows = new Set()

		assert(g.container)
		var cols_tr = g.render_header()
		var rows_tbody = tbody({class: 'rows'})
		for (row of d.rows) {
			var row_tr = g.render_row(row)
			rows_tbody.add(row_tr)
		}
		g.container.set1(
			table(0,
				thead(0, cols_tr),
				rows_tbody
			)
		)

		g.focus_row(rows_tbody.firstChild)
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

