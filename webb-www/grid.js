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
		d.on('reload', g.render)
		d.on('changed', g.changed)

		// render
		g.render()

		// focus the first cell
		g.move_focus(0, 0)
	}

	// rendering --------------------------------------------------------------

	var trs = new Map()

	var render_row = function(row) {
		var tr = H.tr({class: 'grid-row'})
		tr.row = row
		trs.set(row, tr)
		for (var field of fields) {
			var input = H.input({
					type: 'text',
					class: 'grid-input',
					disabled: true,
					maxlength: field.maxlength,
					textAlign: field.align,
					value: d.val(row, field),
				})
			input.w = field.width
			var td = H.td({class: 'grid-cell'}, input)
			tr.add(td)
			td.on('mousedown', function() {
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
			var th = H.th({class: 'grid-header-cell'}, field.name)
			th.w = field.w
			th.field = field
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

	g.first_focusable_cell = function(tr, td, rows, cols) {
		var tr1 = find_sibling(
			tr || g.table.first,
			rows >= 0 && 'next' || 'prev',
			function(tr) { return !tr.first.field },
			function(tr) {
				var found = !rows
				rows -= sign(rows)
				return found
			})
		var td1 = find_sibling(
			tr1 && (td && tr1.at[td.index] || tr1.first),
			cols >= 0 && 'next' || 'prev',
			function(td) {
				return true
			},
			function(td) {
				var found = !cols
				cols -= sign(cols)
				return found
			})
		return [tr1, td1]
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
		return g.focus_cell(...g.first_focusable_cell(g.focused_tr, g.focused_td, rows, cols))
	}

	// editing ----------------------------------------------------------------

	g.input = null

	g.enter_edit = function(where) {
		if (g.input) return
		var td = g.focused_td
		var input = td && td.first
		if (!input) return
		g.input = input
		td.class('grid-cell-editing')
		g.input.attr('disabled', null)
		g.input.focus()
		g.input.on('focusout', g.exit_edit)
		if (where == 'right')
			g.input.setSelectionRange(g.input.value.length, g.input.value.length)
		else if (where == 'left')
			g.input.setSelectionRange(0, 0)
		else
			g.input.setSelectionRange(0, g.input.value.length)
	}

	g.exit_edit = function(cancel) {
		var input = g.input
		if (!input) return
		g.input = null
		var td = input.parent
		var row = g.focused_tr.row
		var field = fields[td.index]
		d.setval(row, field, input.value)
		input.setSelectionRange(0, 0)
		input.attr('disabled', true)
		input.off('focusout', g.exit_edit)
		td.class('grid-cell-editing', false)
	}

	// updating from dataset changes ------------------------------------------

	g.value_changed = function(e, row, field, val) {
		var tr = trs.get(row)
		var td = tr.at[field.index]
		var input = td.first
		input.attr('value', val)
	}

	g.row_added = function(e, row) {
		var tr = render_row(row)
		g.table.add(tr)
		// TODO: re-sort (or use bin-search to add the tr)
	}

	g.delete_row = function(tr) {
		var [next_tr, next_td] =
			   g.first_focusable_cell(tr, g.focused_td,  1, 0)
			|| g.first_focusable_cell(tr, g.focused_td, -1, 0)
		g.focus_cell()
		trs.delete(tr.row)
		tr.remove()
		g.focus_cell(next_tr, next_td)
	}

	g.row_removed = function(e, row) {
		g.delete_row(trs[row])
	}

	// key binding ------------------------------------------------------------

	var keydown = function(e) {

		if (!g.input && (e.key == 'ArrowLeft' || e.key == 'ArrowRight' || e.key == 'Tab')) {

			var moved
			if (e.key == 'Tab') {
				var cols = e.shiftKey ? -1 : 1
				moved = g.move_focus(0, cols) || g.move_focus(cols, cols * -1/0)
			} else {
				var cols = e.key == 'ArrowLeft' ? -1 : 1
				moved = g.move_focus(0, cols)
			}
			if (moved) {
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

		if (e.key == 'ArrowDown' || e.key == 'ArrowUp' || e.key == 'PageDown' || e.key == 'PageUp') {
			var rows
			switch(e.which) {
				case 38: rows = -1; break
				case 40: rows =  1; break
				case 33: rows = -g.page_rows; break
				case 34: rows =  g.page_rows; break
			}

			if (g.move_focus(rows, 0) && g.input && g.immediate_mode)
				g.enter_edit()
			e.preventDefault()
			return
		}

		// F2: enter edit mode
		if (!g.input && e.which == 113) {
			g.enter_edit()
			e.preventDefault()
			return
		}

		// enter: toggle edit mode, and move down on exit
		if (e.which == 13) {
			if (!g.input)
				g.enter_edit()
			else {
				g.exit_edit()
				g.move_focus(1, 0)
			}
			e.preventDefault()
			return
		}

		// esc: exit edit mode
		if (g.input && e.which == 27) {
			g.exit_edit(true)
			e.preventDefault()
			return
		}

		// insert key: insert row
		if (!g.input && e.which == 45) {
			g.insert_row()
			e.preventDefault()
			return
		}

		// delete key: delete active row
		if (!g.input && e.key == 'Delete') {
			var tr = g.focused_tr
			if (!tr) return
			var next_tr = tr.next || tr.prev
			var next_td = next_tr && g.focused_td && next_tr.at[g.focused_td.index]
			g.focus_cell()
			g.delete_row(tr)
			g.focus_cell(next_tr, next_td)
			e.preventDefault()
			return
		}

		// space key on the tree field
		if (!g.input && e.which == 32) {
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
		g.enter_edit()
		g.quick_edit = true
		*/
	}

	document.on('keypress', keypress)

	g.free = function() {
		document.off('keydown', keydown)
		document.off('keypress', keypress)
		d.off('reload', d.render)
		d.off('value_changed', d.value_changed)
		d.off('row_added', d.row_added)
		d.off('row_removed', d.row_removed)
	}

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

