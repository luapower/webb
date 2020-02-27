/*
	Grid/TreeList Widget.
	Written by Cosmin Apreutesei. Public Domain.

	--

*/

function grid(...options) {

	var g = {
		// keyboard behavior
		page_rows: 20,              // how many rows to move on page-down/page-up
		auto_advance: 'next_row',   // advance on enter: 'next_row'|'next_cell'
		auto_advance_row: true,     // jump row on horiz. navigation limits
		auto_jump_cells: true,      // jump to next/prev cell on caret limits
		keep_editing: true,         // re-enter edit mode after navigating
		save_mode: 'exit_row',        // when to save: 'typing'|'exit_edit'|'exit_row'
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
		d.on('value_changed', g.value_changed)

		// render
		g.render()

		// focus the first cell
		g.focus_near_cell(0, 0)
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
				g.focus_cell(this.parent, this)
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
	var find_sibling = function(e, direction, is_valid, stop) {
		var next = direction == 'prev' && prev_e || next_e
		var found = found || return_true
		var last_e
		for (; e; e = next(e))
			if (is_valid(e)) {
				last_e = e
				if (stop(e))
					break
			}
		return last_e
	}

	g.first_focusable_cell = function(tr, td, rows, cols) {
		var want_change_row = rows
		var tr1 = find_sibling(
			tr || g.table.first,
			rows >= 0 && 'next' || 'prev',
			function(tr) { return !tr.first.field },
			function(tr) {
				var stop = !rows
				rows -= sign(rows)
				return stop
			})
		var td1 = find_sibling(
			tr1 && (td && tr1.at[td.index] || tr1.first),
			cols >= 0 && 'next' || 'prev',
			function(td) { return true },
			function(td) {
				var stop = !cols
				cols -= sign(cols)
				return stop
			})
		// if wanted to change row but couldn't, then don't change the col either.
		if (want_change_row && tr1 == tr && td)
			td1 = td
		return [tr1, td1, tr1 != tr || td1 != td]
	}

	g.focus_cell = function(tr, td) {
		if (tr == g.focused_tr && td == g.focused_td)
			return false
		if (g.save_mode == 'exit_row' && tr != g.focused_tr)
			if(!g.save_row())
				return false
		if (!g.exit_edit())
			return false
		if (g.focused_tr) g.focused_tr.class('grid-row-focused', false)
		if (g.focused_td) g.focused_td.class('grid-cell-focused', false)
		if (tr) { tr.class('grid-row-focused'); tr.scrollintoview() }
		if (td) { td.class('grid-cell-focused'); td.scrollintoview() }
		g.focused_tr = tr
		g.focused_td = td
		return true
	}

	g.focus_near_cell = function(rows, cols) {
		return g.focus_cell(...g.first_focusable_cell(g.focused_tr, g.focused_td, rows, cols))
	}

	g.focus_next_cell = function(cols, auto_advance_row) {
		return g.focus_near_cell(0, cols)
			|| ((auto_advance_row || g.auto_advance_row)
					&& g.focus_near_cell(cols, cols * -1/0))
	}

	// editing ----------------------------------------------------------------

	g.input = null

	function input_focusout(e) {
		return g.exit_edit()
	}

	function input_input(e) {
		var row = g.focused_tr.row
		var field = fields[g.focused_td.index]
		if (g.save_mode == 'typing')
			return d.setval(row, field, g.input.value)
	}

	g.enter_edit = function(where) {
		if (g.input)
			return false
		var td = g.focused_td
		var input = td && td.first
		if (!input)
			return false
		g.input = input
		td.class('grid-cell-editing')
		g.input.attr('disabled', null)
		g.input.focus()
		g.input.on('focusout', input_focusout)
		g.input.on('input', input_input)
		if (where == 'right')
			g.input.select(g.input.value.length, g.input.value.length)
		else if (where == 'left')
			g.input.select(0, 0)
		else
			g.input.select(0, g.input.value.length)
		return true
	}

	g.exit_edit = function(cancel) {
		var input = g.input
		if (!input)
			return true
		var td = input.parent
		var row = g.focused_tr.row
		var field = fields[td.index]
		if (cancel)
			input.value = d.val(row, field)
		else if (g.save_mode == 'exit_edit')
			if (!d.setval(row, field, input.value))
				return false
		input.off('focusout', input_focusout)
		input.off('input', input_input)
		input.select(0, 0)
		input.attr('disabled', true)
		td.class('grid-cell-editing', false)
		g.input = null
		return true
	}

	g.save_row = function() {
		var tr = g.focused_tr
		if (!tr)
			return true
		var ok = true
		for (var i = 0; i < fields.length; i++) {
			print(tr.at[i].first.value)
			if (!d.setval(tr.row, fields[i], tr.at[i].first.value))
				ok = false
		}
		return ok
	}


	// updating from dataset changes ------------------------------------------

	g.value_changed = function(e, row, field, val) {
		var tr = trs.get(row)
		var td = tr.at[field.index]
		var input = td.first
		input.value = val
	}

	g.row_added = function(e, row) {
		var tr = render_row(row)
		g.table.add(tr)
		// TODO: re-sort (or use bin-search to add the tr)
	}

	g.delete_row = function(tr) {
		var [next_tr, next_td, changed] = g.first_focusable_cell(tr, g.focused_td,  1, 0)
		if (!changed)
			[next_tr, next_td] = g.first_focusable_cell(tr, g.focused_td, -1, 0)
		g.exit_edit(true)
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

		if (e.key == 'ArrowLeft' || e.key == 'ArrowRight') {

			var cols = e.key == 'ArrowLeft' ? -1 : 1

			var move = !g.input
				|| (g.auto_jump_cells && !e.shiftKey
					&& g.input.caret == (cols < 0 ? 0 : g.input.value.length))

			var reenter_edit = g.input && g.keep_editing && move

			if (move && g.focus_next_cell(cols)) {
				if (reenter_edit)
					g.enter_edit(cols > 0 ? 'left' : 'right')
				e.preventDefault()
				return
			}
		}

		if (e.key == 'Tab') {

			var cols = e.shiftKey ? -1 : 1

			var reenter_edit = g.input

			if (g.focus_next_cell(cols, true))
				if (reenter_edit)
					g.enter_edit(cols > 0 ? 'left' : 'right')

			e.preventDefault()
			return
		}

		if (e.key == 'ArrowDown' || e.key == 'ArrowUp' || e.key == 'PageDown' || e.key == 'PageUp') {

			var rows
			switch(e.which) {
				case 38: rows = -1; break
				case 40: rows =  1; break
				case 33: rows = -g.page_rows; break
				case 34: rows =  g.page_rows; break
			}

			var reenter_edit = g.input && g.keep_editing

			if (g.focus_near_cell(rows, 0)) {
				if (reenter_edit)
					g.enter_edit()
				e.preventDefault()
				return
			}
		}

		// F2: enter edit mode
		if (!g.input && e.which == 113) {
			g.enter_edit()
			e.preventDefault()
			return
		}

		// enter: toggle edit mode, and navigate on exit
		if (e.key == 'Enter') {
			if (!g.input)
				g.enter_edit()
			else if (g.exit_edit()) {
				if (g.auto_advance == 'next_row')
					if (g.focus_near_cell(1, 0))
						if (g.keep_editing)
							g.enter_edit()
				else if (g.auto_advance == 'next_cell')
					if (g.focus_next_cell(1))
						if (g.keep_editing)
							g.enter_edit()
			}
			e.preventDefault()
			return
		}

		// esc: exit edit mode
		if (g.input && e.key == 'Escape') {
			g.exit_edit(true)
			e.preventDefault()
			return
		}

		// insert key: insert row
		if (!g.input && e.key == 'Insert') {
			g.insert_row()
			e.preventDefault()
			return
		}

		// delete key: delete active row
		if (!g.input && e.key == 'Delete') {
			var tr = g.focused_tr
			if (!tr) return
			g.delete_row(tr)
			e.preventDefault()
			return
		}

		// space key on the tree field
		if (!g.input && e.key == ' ') {
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

