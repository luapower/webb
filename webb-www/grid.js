/*
	Grid/TreeList Widget.
	Written by Cosmin Apreutesei. Public Domain.

	--

*/

function grid(...options) {

	var g = {
		// behavior
		page_rows: 20,              // how many rows to move on page-down/page-up
		immediate_mode: false,      // stay in edit mode while navigating
		save_on_exit_row: true,     // trigger save on vertical movement
		save_on_exit_edit: false,   // trigger save when done editing each cell
	}

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

		// focus the first cell
		g.move_focus(0, 0)
	}

	// rendering --------------------------------------------------------------

	var render_row = function(row) {
		var tr = H.tr({class: 'grid-row'})
		tr.row = row
		for (var field of fields) {
			var td = H.td({class: 'grid-cell'}, d.val(row, field))
			tr.add(td)
			td.on('click', function() {
				g.focus_cell(this.parentNode, this)
			})
		}
		return tr
	}

	g.render = function() {
		g.focus_cell()
		g.table = H.table({class: 'grid'})
		var header_tr = H.tr({class: 'grid-header-row'})
		for (var field of fields) {
			var th = H.th({class: 'grid-header-col'}, field.name)
			header_tr.add(th)
		}
		g.table.add(header_tr)
		for (var row of d.rows) {
			var tr = render_row(row)
			g.table.add(tr)
		}
		g.div = H.div({class: 'grid-div'}, g.table)
		g.container.set1(g.div)

	}

	// cell focusing ----------------------------------------------------------

	g.focused_tr = null
	g.focused_td = null

	var next_e = function(e) { return e.next; }
	var prev_e = function(e) { return e.prev; }
	var find_sibling = function(e, direction, filter, found) {
		var next = direction == 'prev' && prev_e || next_e
		var found = found || return_true
		var found_e
		for (; e; e = next(e))
			if (filter(e)) {
				found_e = e
				if (found(e))
					break
			}
		return found_e
	}

	g.first_focusable_cell = function() {
		var tr = find_sibling(g.table.first, 'next',
			function(tr) {
				return tr.first.tagName == 'TD'
			})
		if (!tr) return
		var td = find_sibling(tr.first, 'next',
			function(td) {
				return true
			})
		return [tr, td]
	}

	g.focus_cell = function(tr, td) {
		var changed = tr != g.focused_tr || td != g.focused_td
		if (!changed) return false
		g.exit_edit()
		if (g.focused_tr) g.focused_tr.class('grid-row-focused', false)
		if (g.focused_td) g.focused_td.class('grid-cell-focused', false)
		if (tr) { tr.class('grid-row-focused'); tr.scrollintoview() }
		if (td) { td.class('grid-cell-focused'); td.scrollintoview() }
		g.focused_tr = tr
		g.focused_td = td
		return true
	}

	g.move_focus = function(rows, cols) {

		var tr = find_sibling(
			g.focused_tr || g.table.first,
			rows >= 0 && 'next' || 'prev',
			function(tr) {
				return tr.first.tagName == 'TD'
			},
			function(tr) {
				var found = !rows
				rows -= sign(rows)
				return found
			})

		var td = find_sibling(
			tr && (g.focused_td && tr.at[g.focused_td.index] || tr.first),
			cols >= 0 && 'next' || 'prev',
			function(td) {
				return true
			},
			function(td) {
				var found = !cols
				cols -= sign(cols)
				return found
			})

		return g.focus_cell(tr, td)
	}

	// editing ----------------------------------------------------------------

	g.input = null

	g.enter_edit = function(caret_pos, select) {
		if (g.input) return

		var td = g.focused_td
		if (!td) return

		var field = fields[td.index]

		g.input = H.input({
			type: 'text', class: 'grid-input',
			maxlength: field.maxlength,
			value: d.val(td.parent.row, field),
		})
		//g.input.style.width  = td.clientWidth+'px'
		//g.input.style.height = td.clientHeight+'px'
		g.input.style.textAlign = field.align
		td.innerHTML = ''
		td.set1(g.input)
		g.input.focus()
		g.input.caret_pos = caret_pos
	}

	g.exit_edit = function() {
		if (!g.input) return
		var td = g.input.parent
		var row = g.focused_tr.row
		var field = fields[td.index]
		d.setval(row, field, g.input.value)
		td.innerHTML = d.val(row, field)
		g.input = null
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

	// key binding ------------------------------------------------------------

	var input

	var keydown = function(e) {

		// left and right arrows, tab and shift-tab: move left-right
		if (!g.input && (e.which == 37 || e.which == 39 || e.which == 9)) {

			var cols = e.which == 9 ? (e.shiftKey ? -1 : 1) : (e.which == 37 ? -1 : 1)

			if (g.move_focus(0, cols)) {
				e.preventDefault()
				return
			}

			/*
			if (
				(e.altKey && e.shiftKey && !e.ctrlKey)
				|| g.quick_edit
			|| (g.immediate_mode &&
					g.focused() &&
					g.caret() == (cols < 0 ? 0 : input.val().length) &&
						(e.which == 9 || !e.shiftKey)
			) {
				if (g.move_focus(0, cols))
					// if (input && g.immediate_mode)
					// 	g.enter_edit(cols < 0 ? -1 : 0)
				e.preventDefault()
				return
			}
			*/


		}

		// (!input || g.immediate_mode || g.quick_edit)

		// up, down, page-up, page-down: move up-down
		if (e.which == 38 || e.which == 33 || e.which == 40 || e.which == 34) {
			var rows
			switch(e.which) {
				case 38: rows = -1; break
				case 40: rows =  1; break
				case 33: rows = -g.page_rows; break
				case 34: rows =  g.page_rows; break
			}

			if (g.move_focus(rows, 0) && input && g.immediate_mode)
				g.enter_edit(-1, input.selected)
			e.preventDefault()
			return
		}

		// F2: enter edit mode
		if (!input && e.which == 113) {
			g.enter_edit(null, true)
			e.preventDefault()
			return
		}

		// enter: toggle edit mode, and move down on exit
		if (e.which == 13) {
			if (!g.input)
				g.enter_edit(null, true)
			else {
				g.exit_edit()
				g.move_focus(1, 0)
			}
			e.preventDefault()
			return
		}

		// esc: exit edit mode
		if (input && e.which == 27) {
			g.exit_edit(true)
			e.preventDefault()
			return
		}

		// insert key: insert row
		if (!input && e.which == 45) {
			g.insert_row()
			e.preventDefault()
			return
		}

		// delete key: delete active row
		if (!input && e.which == 46) {
			g.delete_row()
			e.preventDefault()
			return
		}

		// space key on the tree field
		if (!input && e.which == 32) {
			g.toggle_expand_cell(active_cell)
			e.preventDefault()
			return
		}

	}

	document.on('keydown', keydown)

	// printable characters: enter quick edit mode
	var keypress = function(e) {
		/*
		if (!g.active()) return
		if (e.charCode == 0) return
		if (e.ctrlKey  || e.metaKey || e.altKey) return
		if (g.input()) return
		g.enter_edit(null, true)
		g.quick_edit = true
		*/
	}

	document.on('keypress', keypress)

	/*
	// moving -----------------------------------------------------------------

	var move_table, place_td

	g.start_moving_col = function(col_index) {
		var col_td = table.at[0].at[col_index]
		var pos = col_td.pos
		print(pos)
		move_table = div({class: 'grid grid-move-grid'})
		for (child_tr of table.at) {
			var cell = child_tr.at[col_index]
			var move_tr = tr()
			move_tr.add(cell)
			move_table.add(move_tr)
		}
		g.div.add(move_table)
		move_table.pos = pos
		print(move_table.pos)
		place_td = td({width: col_td.clientWidth, rowspan: d.rows.length + 1})
		grid_table.at[0].insert(col_index, place_td)
		return move_table
	}

	g.stop_moving_col = function() {
		//
	}
	*/

	init()

	return g
}

