/*
	Grid/TreeList Widget.
	Written by Cosmin Apreutesei. Public Domain.

	Field attributes:
		commit_edits:

*/

function grid(...options) {

	let g = {
		// keyboard behavior
		page_rows: 20,              // how many rows to move on page-down/page-up
		auto_advance: 'next_row',   // advance on enter: false|'next_row'|'next_cell'
		auto_advance_row: true,     // jump row on horiz. navigation limits
		auto_jump_cells: true,      // jump to next/prev cell on caret limits
		keep_editing: true,         // re-enter edit mode after navigating
		commit_edits: 'exit_row',   // when to update the dataset: 'input'|'exit_edit'|'exit_row'|false
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

		init_order_by()

		g.reload()

		g.sort()
	}

	function onoff_events(on) {
		document.onoff('keydown'  , keydown  , on)
		document.onoff('keypress' , keypress , on)
		document.onoff('mousedown', mousedown, on)
		document.onoff('mouseup'  , mouseup  , on)
		document.onoff('mousemove', mousemove, on)
		d.onoff('reload'       , g.reload       , on)
		d.onoff('value_changed', g.value_changed, on)
		d.onoff('row_added'    , d.row_added    , on)
		d.onoff('row_removed'  , d.row_removed  , on)
	}

	g.free = function() {
		onoff_events(false)
	}

	// rendering --------------------------------------------------------------

	property(g, 'last_tr', { get: function() {
		let tr = g.table.lastElementChild
		return tr && tr.hasclass('grid-row') && tr || undefined
	}})

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

			td.class('read_only', !d.can_change_cell(row, field))

			td.on('mousedown', function() {
				if (g.table.hasclass('col-resize'))
					return

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

	function update_sort_icons() {
		let ths = g.table.at[0].children
		for (let i = 0; i < fields.length; i++) {
			let field = fields[i]
			let dir = g.order_by_dir(field)
			let sort_icon = ths[i].sort_icon
			sort_icon.class('fa-sort', false)
			sort_icon.class('fa-angle-up', false)
			sort_icon.class('fa-angle-down', false)
			sort_icon.class(
				   dir == 'asc'  && 'fa-angle-up'
				|| dir == 'desc' && 'fa-angle-down'
			   || 'fa-sort', true)
		}
	}

	function lr_table(e1, e2, reverse) {
		if (reverse)
			[e1, e2] = [e2, e1]
		return (
			H.table({width: '100%'},
				H.tr(0,
					H.td({align: 'left' }, e1),
					H.td({align: 'right'}, e2))))
	}

	g.render = function() {
		if (g.table)
			g.focus_cell()
		g.table = H.table({class: 'grid-table'})

		let header_tr = H.tr({class: 'grid-header-row'})
		for (let field of fields) {

			let sort_icon  = H.div({class: 'fa grid-sort-icon'})
			let title_table = lr_table(field.name, sort_icon, field.align == 'right')

			function toggle_order(e) {
				if (g.table.hasclass('col-resize'))
					return

				if (e.which == 3)  // right-click
					g.clear_order()
				else
					g.toggle_order(field, e.shiftKey)
				e.preventDefault()
			}

			let th = H.th({class: 'grid-header-cell'}, title_table)

			th.sort_icon = sort_icon

			th.style.width    = field.width && field.width + 'px'
			th.style.maxWidth = field.max_width && field.max_width + 'px'
			th.style.minWidth = field.min_width && field.min_width + 'px'
			th.field = field
			th.on('mousedown', toggle_order)
			th.on('contextmenu', function(e) { e.preventDefault() })

			header_tr.add(th)
		}
		g.table.add(header_tr)
		update_sort_icons()

		for (let row of d.rows) {
			let tr = render_row(row)
			g.table.add(tr)
		}

		g.container.set1(g.table)
	}

	g.row_tr = function(row) {
		for (let tr of g.table.children)
			if (tr.row == row)
				return tr
	}

	g.field_td = function(tr, field) {
		let fi = fields.indexOf(field)
		if (fi != -1) return tr.at[i]
	}

	g.reload = function() {
		let row   = g.focused_tr && g.focused_tr.row
		let field = g.focused_td && fields[g.focused_td.index]
		g.render()
		// find focused row & field again and re-focus them.
		let tr = row && g.row_tr(row)
		if (tr) {
			let td = field && g.field_td(tr, field)
			g.focus_cell(tr, td, false)
			return
		}
		g.focus_near_cell(0, 0, false)
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
			function(td) {
				return d.can_change_cell(tr1.row, fields[td.index])
			},
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

	function focus_cell(tr, td, scrollintoview) {
		if (tr == g.focused_tr && td == g.focused_td)
			return false
		if (g.commit_edits == 'exit_row' && g.focused_tr && tr != g.focused_tr)
			if(!g.commit_row(g.focused_tr))
				if (!g.allow_invalid_values)
					return false
		if (!g.exit_edit())
			return false
		if (g.focused_tr) g.focused_tr.class('focused', false)
		if (g.focused_td) g.focused_td.class('focused', false)
		if (tr) { tr.class('focused', true); if (scrollintoview !== false) tr.scrollintoview() }
		if (td) { td.class('focused', true); if (scrollintoview !== false) td.scrollintoview() }
		g.focused_tr = tr
		g.focused_td = td
		return true
	}

	g.focus_cell = function(tr, td, scrollintoview) {
		var [tr, td] = g.first_focusable_cell(tr, td, 0, 0)
		return focus_cell(tr, td, scrollintoview)
	}

	g.focus_near_cell = function(rows, cols, scrollintoview) {
		let [tr, td] = g.first_focusable_cell(g.focused_tr, g.focused_td, rows, cols)
		return focus_cell(tr, td, scrollintoview)
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

	function no_cell_has_class(tr, classname) {
		for (let td of tr.children)
			if (td.hasclass(classname))
				return false
		return true
	}

	function set_invalid_cell(td, invalid, err) {
		td.class('invalid', invalid)
		if (invalid) {
			set_invalid_row(td.parent, true)
			if (err)
				g.error(err, td)
		} else if (no_cell_has_class(td.parent, 'invalid'))
			set_invalid_row(td.parent, false)
	}

	function set_invalid_row(tr, invalid) {
		tr.class('invalid', invalid)
	}

	function set_modified_cell(td, modified) {
		set_invalid_cell(td, false)
		td.class('modified', modified)
		if (modified)
			set_modified_row(td.parent, true)
		else if (no_cell_has_class(td.parent, 'modified'))
			set_modified_row(td.parent, false)
	}

	function set_modified_row(tr, modified) {
		set_invalid_row(tr, false)
		tr.class('modified', modified)
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
		set_modified_cell(td, true)
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
		td.class('editing', true)
		g.input.attr('disabled', null)
		g.input.focus()
		g.input.on('focusout', input_focusout)
		g.input.on('input', input_input)
		if (where == 'right')
			g.input.select(g.input.value.length, g.input.value.length)
		else if (where == 'left')
			g.input.select(0, 0)
		else if (where)
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
			set_modified_cell(td, false)
			return true
		} else {
			set_invalid_cell(td, true, ret)
			return false
		}
	}

	g.commit_row = function(tr, cancel) {
		let ok = true
		for (td of tr.children)
			if (td.hasclass('modified'))
				if (!g.commit_cell(td, cancel))
					ok = false
		return ok
	}

	// adding & removing rows -------------------------------------------------

	g.insert_row = function(add) {
		if (!d.can_add_rows)
			return
		let field_index = g.focused_td && g.focused_td.index
		let reenter_edit = g.input && g.keep_editing
		let row = d.add_row()
		let tr = render_row(row)
		if (add || !g.focused_tr)
			g.table.add(tr)
		else
			g.table.insertBefore(tr, g.focused_tr)
		tr.class('new', true)
		let td = field_index && tr.at[field_index]
		g.focus_cell(tr, td)
		if (reenter_edit)
			g.enter_edit(true)
	}

	g.add_row = function() {
		g.insert_row(true)
	}

	g.remove_row = function(tr) {
		if (!d.can_remove_row(tr.row))
			return // TODO: show error message
		let reenter_edit = g.input && g.keep_editing
		let [next_tr, next_td, changed] = g.first_focusable_cell(tr, g.focused_td, 1, 0)
		if (!changed)
			[next_tr, next_td, changed] = g.first_focusable_cell(tr, g.focused_td, -1, 0)
		if (!changed)
			[next_tr, next_td] = [null, null]
	 	g.exit_edit(true)
		g.focus_cell()
		trs.delete(tr.row)
		tr.remove()
		g.focus_cell(next_tr, next_td)
		if (reenter_edit)
			g.enter_edit(true)
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

	g.row_removed = function(e, row) {
		g.remove_row(trs[row])
	}

	// key bindings -----------------------------------------------------------

	function keydown(e) {

		// Arrows: horizontal navigation.
		if (e.key == 'ArrowLeft' || e.key == 'ArrowRight') {

			let cols = e.key == 'ArrowLeft' ? -1 : 1

			let reenter_edit = g.input && g.keep_editing

			let move = !g.input
				|| (g.auto_jump_cells && !e.shiftKey
					&& g.input.caret == (cols < 0 ? 0 : g.input.value.length))

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

			let reenter_edit = g.input && g.keep_editing

			if (g.focus_next_cell(cols, true))
				if (reenter_edit)
					g.enter_edit(cols > 0 ? 'left' : 'right')

			e.preventDefault()
			return
		}

		// insert with the arrow down key on the last row.
		if (e.key == 'ArrowDown' && g.focused_tr == g.last_tr) {
			g.add_row()
			e.preventDefault()
			return
		}

		// remove last row with the arrow up key if not edited.
		if (e.key == 'ArrowUp'
			&& g.focused_tr == g.table.lastElementChild
			&& g.focused_tr.hasclass('new')
			&& !g.focused_tr.hasclass('modified')
		) {
			g.remove_row(g.focused_tr)
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
					g.enter_edit(true)
				e.preventDefault()
				return
			}
		}

		// F2: enter edit mode
		if (!g.input && e.key == 'F2') {
			g.enter_edit(true)
			e.preventDefault()
			return
		}

		// Enter: toggle edit mode, and navigate on exit
		if (e.key == 'Enter') {
			if (!g.input) {
				g.enter_edit(true)
			} else if (g.exit_edit()) {
				if (g.auto_advance == 'next_row') {
					if (g.focus_near_cell(1, 0))
						if (g.keep_editing)
							g.enter_edit(true)
				} else if (g.auto_advance == 'next_cell')
					if (g.focus_next_cell(1))
						if (g.keep_editing)
							g.enter_edit(true)
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
		if (e.key == 'Insert') {
			g.insert_row()
			e.preventDefault()
		}

		// delete key: delete active row
		if (!g.input && e.key == 'Delete') {
			let tr = g.focused_tr
			if (!tr) return
			g.remove_row(tr)
			e.preventDefault()
			return
		}

	}

	// printable characters: enter quick edit mode
	function keypress(e) {
		if (!g.input)
			g.enter_edit(true)
	}

	// make columns resizeable ------------------------------------------------

	let hit_td, hit_x, col_resizing

	function mousedown(e) {
		if (col_resizing || !hit_td)
			return
		col_resizing = true
		g.table.class('col-resizing', true)
		e.preventDefault()
	}

	function mouseup(e) {
		col_resizing = false
		g.table.class('col-resizing', false)
		g.table.class('col-resize', false)
	}

	function mousemove(e) {
		if (col_resizing) {
			let w = e.clientX - (g.table.offsetLeft + hit_td.offsetLeft + hit_x)
			hit_td.style.width = w + 'px'
			e.preventDefault()
		} else {
			hit_td = null
			for (td of g.table.first.children) {
				hit_x = e.clientX - (g.table.offsetLeft + td.offsetLeft + td.offsetWidth)
				if (hit_x >= -5 && hit_x <= 5) {
					hit_td = td
					break
				}
			}
			g.table.class('col-resize', !!hit_td)
		}
	}

	// sorting ----------------------------------------------------------------

	let order_by_dir

	function init_order_by() {
		let order_by = g.order_by || ''
		delete g.order_by
		property(g, 'order_by', {
			get: function() {
				let a = []
				for (let [field, dir] of order_by_dir) {
					a.push(field.name + (dir == 'asc' ? '' : ':desc'))
				}
				return a.join(' ')
			},
			set: function(s) {
				order_by_dir = new Map()
				let ea = s.split(/[\s,]+/)
				for (let e of ea) {
					let m = e.match('^([^\:]*):?(\.*)$')
					let name = m[1]
					let field = d.field(name)
					if (field) {
						let dir = m[2] || 'asc'
						if (dir == 'asc' || dir == 'desc')
							order_by_dir.set(field, dir)
					}
				}
			}
		})
		g.order_by = order_by || ''
	}

	g.order_by_dir = function(field) {
		return order_by_dir.get(field)
	}

	g.toggle_order = function(field, keep_others) {
		let dir = order_by_dir.get(field)
		dir = dir == 'asc' ? 'desc' : 'asc' // (dir == 'desc' ? null : 'asc')
		if (!keep_others)
			order_by_dir.clear()
		if (!dir)
			order_by_dir.delete(field)
		else
			order_by_dir.set(field, dir)
		g.sort()
	}

	g.clear_order = function() {
		order_by_dir.clear()
		g.sort()
	}

	g.sort = function() {

		let s = []
		let cmps = []
		for (let [field, dir] of order_by_dir) {
			let i = field.index
			cmps[i] = d.comparator(field)
			let r = dir == 'asc' ? 1 : -1
			// header row comes first
			s.push('if (!tr1.row) return -1')
			s.push('if (!tr2.row) return  1')
			// invalid values come first
			s.push('var v1 = !tr1.at['+i+'].hasclass("invalid")')
			s.push('var v2 = !tr2.at['+i+'].hasclass("invalid")')
			s.push('if (v1 < v2) return -1')
			s.push('if (v1 > v2) return  1')
			// compare values using the dataset comparator
			s.push('var v1 = tr1.row.values['+i+']')
			s.push('var v2 = tr2.row.values['+i+']')
			s.push('var cmp = cmps['+i+']')
			s.push('var r = cmp(v1, v2)')
			s.push('if (r) return r * '+r)
		}
		s.push('return 0')
		s = 'let f = function(tr1, tr2) {\n\t' + s.join('\n\t') + '\n}; f'
		let cmp = eval(s)

		g.table.add(Array.from(g.table.children).sort(cmp))

		update_sort_icons()
	}

	init()

	return g
}

