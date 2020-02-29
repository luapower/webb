/*
	Grid/TreeList Widget.
	Written by Cosmin Apreutesei. Public Domain.

	Field attributes:
		commit_edits:
		save_mode:

*/

function grid(...options) {

	let g = {
		// keyboard behavior
		page_rows: 20,              // how many rows to move on page-down/page-up
		auto_advance: 'next_cell',  // advance on enter: 'next_row'|'next_cell'
		auto_advance_row: true,     // jump row on horiz. navigation limits
		auto_jump_cells: true,      // jump to next/prev cell on caret limits
		keep_editing: true,         // re-enter edit mode after navigating
		commit_edits: 'exit_edit',  // when to update the dataset: 'input'|'exit_edit'|'exit_row'
		save_row: 'exit_row',       // when to save the row: 'input'|'exit_edit'|'exit_row'|'manual'
		allow_invalid_values: true, // allow exiting edit mode on invalid value.
	}

	let d
	let fields

	init = function() {

		// set options/override.
		update(g, ...options)

		d = g.dataset

		fields = []
		if (g.cols) {
			for (let fi of g.cols)
				fields.push(d.fields[fi])
		} else
			fields = d.fields.slice()

		onoff_events(true)
		g.render()
		g.focus_near_cell(0, 0)
	}

	function onoff_events(on) {
		document.onoff('keydown'  , keydown  , on)
		document.onoff('keypress' , keypress , on)
		document.onoff('mousedown', mousedown, on)
		document.onoff('mouseup'  , mouseup  , on)
		document.onoff('mousemove', mousemove, on)
		d.onoff('reload'       , g.render       , on)
		d.onoff('value_changed', g.value_changed, on)
		d.onoff('row_added'    , d.row_added    , on)
		d.onoff('row_removed'  , d.row_removed  , on)
	}

	g.free = function() {
		onoff_events(false)
	}

	// rendering --------------------------------------------------------------

	let trs = new Map()

	let render_row = function(row) {
		let tr = H.tr({class: 'grid-row'})
		tr.row = row
		trs.set(row, tr)
		for (let i = 0; i < fields.length; i++) {
			let field = fields[i]

			let input = H.input({
					type: 'text',
					class: 'grid-input',
					disabled: true,
					maxlength: field.maxlength,
					value: d.val(row, field),
				})
			input.style.width = '100%'
			input.style.textAlign = field.align

			let td = H.td({class: 'grid-cell', width: 1}, input)

			td.on('mousedown', function() {
				let td = this
				let tr = this.parent
				if (g.focused_tr == tr && g.focused_td == td)
					g.enter_edit()
				else
					g.focus_cell(tr, td)
			})

			tr.add(td)
		}
		return tr
	}

	g.render = function() {
		g.focus_cell()
		g.table = H.table({class: 'grid-table'})

		let header_tr = H.tr({class: 'grid-header-row'})
		for (let field of fields) {

			let sort_icon  = H.div({class: 'fa fa-sort grid-sort-icon'})
			let sort_left  = field.align == 'right' ? H.span({style: 'float: left' }, sort_icon) : null
			let sort_right = field.align != 'right' ? H.span({style: 'float: right'}, sort_icon) : null

			let d.order

			sort_icon.on('click', function() {
				if (
				g.toggle_sort(field)
			})

			let th = H.th({
				class: 'grid-header-cell',
				align: field.align || 'left',
			}, sort_left, field.name, sort_right)

			th.style.width    = field.width && field.width + 'px'
			th.style.maxWidth = field.max_width && field.max_width + 'px'
			th.style.minWidth = field.min_width && field.min_width + 'px'
			th.field = field

			header_tr.add(th)
		}
		g.table.add(header_tr)

		for (let row of d.rows) {
			let tr = render_row(row)
			g.table.add(tr)
		}

		g.container.set1(g.table)
	}

	// focusing ---------------------------------------------------------------

	g.focused_tr = null
	g.focused_td = null

	let next_e = function(e) { return e.next; }
	let prev_e = function(e) { return e.prev; }
	let find_sibling = function(e, direction, is_valid, stop) {
		let next = direction == 'prev' && prev_e || next_e
		is_valid = is_valid || return_true
		let last_e
		for (; e; e = next(e))
			if (is_valid(e)) {
				last_e = e
				if (stop(e))
					break
			}
		return last_e
	}

	g.first_focusable_cell = function(tr, td, rows, cols) {
		let want_change_row = rows
		let tr1 = find_sibling(
			tr || g.table.first,
			rows >= 0 && 'next' || 'prev',
			function(tr) { return !tr.first.field },
			function(tr) {
				let stop = !rows
				rows -= sign(rows)
				return stop
			})
		let td1 = find_sibling(
			tr1 && (td && tr1.at[td.index] || tr1.first),
			cols >= 0 && 'next' || 'prev',
			function(td) { return true },
			function(td) {
				let stop = !cols
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
		if (g.commit_edits == 'exit_row' && g.focused_tr && tr != g.focused_tr)
			if(!g.commit_row(g.focused_tr))
				return false
		if (!g.exit_edit())
			return false
		if (g.focused_tr) g.focused_tr.class('focused', false)
		if (g.focused_td) g.focused_td.class('focused', false)
		if (tr) { tr.class('focused'); tr.scrollintoview() }
		if (td) { td.class('focused'); td.scrollintoview() }
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

	g.error = function(msg, td) {
		let div = H.div({class: 'grid-error'}, msg)
	}

	function set_invalid(td, invalid, err) {
		td.class('invalid', invalid)
		if (invalid && err)
			g.error(err, td)
	}

	function set_modified(td, v) {
		set_invalid(td, false)
		td.class('modified', v)
	}

	function input_focusout(e) {
		g.exit_edit()
		return
	}

	function should_commit(td, s) {
		return g.commit_edits == s || fields[td.index].commit_edits == s
	}

	function input_input(e) {
		let td = g.input.parent
		set_modified(td, true)
		if (should_commit(td, 'input'))
			g.commit_cell(g.focused_td)
	}

	g.enter_edit = function(where) {
		if (g.input)
			return false
		let td = g.focused_td
		let input = td && td.first
		if (!input)
			return false
		g.input = input
		td.class('editing')
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
		let input = g.input
		if (!input)
			return true
		let td = input.parent
		if (should_commit(td, 'exit_edit'))
			if (!g.commit_cell(td, cancel))
				if (!g.allow_invalid_values)
					return false
		input.off('focusout', input_focusout)
		input.off('input', input_input)
		input.select(0, 0)
		input.attr('disabled', true)
		td.class('editing', false)
		g.input = null
		return true
	}

	// saving -----------------------------------------------------------------

	g.commit_cell = function(td, cancel) {
		let row = td.parent.row
		let field = fields[td.index]
		let input = td.first
		let ret = (cancel && true) || d.setval(row, field, input.value)
		if (ret === true) {
			input.value = d.val(row, field)
			set_modified(td, false)
			return true
		} else {
			set_invalid(td, true, ret)
			return false
		}
	}

	g.commit_row = function(tr, cancel) {
		let ok = true
		for (td of tr)
			if (!g.commit_cell(td, cancel))
				ok = false
		return ok
	}

	// updating from dataset changes ------------------------------------------

	function value_changed(e, row, field, val) {
		let tr = trs.get(row)
		let td = tr.at[field.index]
		let input = td.first
		input.value = val
	}

	g.row_added = function(e, row) {
		let tr = render_row(row)
		g.table.add(tr)
		// TODO: re-sort (or use bin-search to add the tr)
	}

	g.delete_row = function(tr) {
		let [next_tr, next_td, changed] = g.first_focusable_cell(tr, g.focused_td,  1, 0)
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

	// key bindings -----------------------------------------------------------

	function keydown(e) {

		// Arrows: horizontal navigation.
		if (e.key == 'ArrowLeft' || e.key == 'ArrowRight') {

			let cols = e.key == 'ArrowLeft' ? -1 : 1

			let move = !g.input
				|| (g.auto_jump_cells && !e.shiftKey
					&& g.input.caret == (cols < 0 ? 0 : g.input.value.length))

			let reenter_edit = g.input && g.keep_editing && move

			if (move && g.focus_next_cell(cols)) {
				if (reenter_edit)
					g.enter_edit(cols > 0 ? 'left' : 'right')
				e.preventDefault()
				return
			}
		}

		// Tab/Shift+Tab cell navigation.
		if (e.key == 'Tab') {

			let cols = e.shiftKey ? -1 : 1

			let reenter_edit = g.input

			if (g.focus_next_cell(cols, true))
				if (reenter_edit)
					g.enter_edit(cols > 0 ? 'left' : 'right')

			e.preventDefault()
			return
		}

		// vertical navigation.
		if (e.key == 'ArrowDown' || e.key == 'ArrowUp'
			|| e.key == 'PageDown' || e.key == 'PageUp') {

			let rows
			switch (e.key) {
				case 'ArrowUp'   : rows = -1; break
				case 'ArrowDown' : rows =  1; break
				case 'PageUp'    : rows = -g.page_rows; break
				case 'PageDown'  : rows =  g.page_rows; break
			}

			let reenter_edit = g.input && g.keep_editing

			if (g.focus_near_cell(rows, 0)) {
				if (reenter_edit)
					g.enter_edit()
				e.preventDefault()
				return
			}
		}

		// F2: enter edit mode
		if (!g.input && e.key == 'F2') {
			g.enter_edit()
			e.preventDefault()
			return
		}

		// Enter: toggle edit mode, and navigate on exit
		if (e.key == 'Enter') {
			if (!g.input) {
				g.enter_edit()
			} else if (g.exit_edit()) {
				if (g.auto_advance == 'next_row') {
					if (g.focus_near_cell(1, 0))
						if (g.keep_editing)
							g.enter_edit()
				} else if (g.auto_advance == 'next_cell')
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
			let tr = g.focused_tr
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

	// printable characters: enter quick edit mode
	function keypress(e) {
		/*
		if (!g.active()) return
		if (e.charCode == 0) return
		if (e.ctrlKey  || e.metaKey || e.altKey) return
		if (g.input()) return
		g.enter_edit()
		g.quick_edit = true
		*/
	}

	// make columns resizeable ------------------------------------------------

	let hit_th, hit_x, col_resizing

	function mousedown(e) {
		if (col_resizing || !hit_th)
			return
		col_resizing = true
		e.preventDefault()
	}

	function mouseup(e) {
		col_resizing = false
	}

	function mousemove(e) {
		if (col_resizing) {
			let w = e.clientX - hit_th.offsetLeft + hit_x
			hit_th.style.width = w + 'px'
			e.preventDefault()
			return
		}
		hit_th = null
		for (th of g.table.first.childNodes) {
			hit_x = th.offsetWidth - (e.clientX - th.offsetLeft)
			if (hit_x >= -10 && hit_x <= 10) {
				hit_th = th
				break
			}
		}
		g.table.style.cursor = hit_th ? 'col-resize' : null
	}

	init()

	return g
}

