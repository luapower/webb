/*
	Grid/TreeList Widget.
	Written by Cosmin Apreutesei. Public Domain.

*/

function grid(...options) {

	let g = {
		// geometry
		w: 500,
		h: 400,
		row_h: 24,
		row_border_h: 1,
		// keyboard behavior
		page_rows: 20,            // how many rows to move on page-down/page-up
		auto_advance: 'next_row', // advance on enter: false|'next_row'|'next_cell'
		auto_advance_row: true,   // jump row on horiz. navigation limits
		auto_jump_cells: true,    // jump to next/prev cell on caret limits
		keep_editing: true,       // re-enter edit mode after navigating
		save_cell_on: 'input',    // save cell on 'input'|'exit_edit'
		save_row_on: 'exit_edit', // save row on 'input'|'exit_edit'|'exit_row'|false
		prevent_exit_edit: false, // prevent exiting edit mode on validation errors
		prevent_exit_row: true,   // prevent changing row on validation errors
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

	// virtual grid geometry --------------------------------------------------

	function visible_row_count() {
		return floor(g.rows_view_h / g.row_h) + 2
	}

	function scroll_y(sy) {
		return clamp(sy, 0, g.rows_h - g.rows_view_h)
	}

	function first_visible_row(sy) {
		return floor(sy / g.row_h)
	}

	function rows_y_offset(sy) {
		return floor(sy - sy % g.row_h)
	}

	function init_geometry() {
		g.rows_h = g.row_h * d.rows.length - floor(g.row_border_h / 2)
		g.rows_view_h = g.h - g.grid_div.clientHeight
	}

	// rendering --------------------------------------------------------------

	/*
			let input = H.input({
					type: 'text',
					class: 'grid-input',
					disabled: true,
					maxlength: field.maxlength,
					value: d.value(row, field),
				})
			input.style.textAlign = field.align
	*/

	function update_sort_icons() {
		for (let th of g.header_tr.children) {
			let dir = g.order_by_dir(th.field)
			let sort_icon = th.sort_icon
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
			H.table({class: 'grid-header-th-table', width: '100%'},
				H.tr(0,
					H.td({align: 'left' }, e1),
					H.td({align: 'right'}, e2))))
	}

	function render_row(tr, row) {
		for (let i = 0; i < fields.length; i++) {
			let field = fields[i]
			let td = tr.at[i]
			td.innerHTML = d.value(row.row, field)
			td.class('read_only', !d.can_change_value(row, field))
		}
	}

	function render_rows() {
		sy = scroll_y(g.rows_view_div.scrollTop)
		let i0 = first_visible_row(sy)
		g.rows_table.y = rows_y_offset(sy)
		let n = visible_row_count()
		n = min(n, d.rows.length - i0)
		for (let i = 0; i < n; i++) {
			let tr = g.rows_table.at[i]
			let row = g.rows[i0 + i]
			render_row(tr, row)
		}
	}

	g.render = function() {
		if (g.grid_div)
			g.focus_cell()

		g.rows = []
		for (let i = 0; i < d.rows.length; i++)
			g.rows[i] = {row: d.rows[i]}

		g.header_tr = H.tr()
		g.header_table = H.table({class: 'grid-header-table'}, g.header_tr)
		g.rows_table = H.table({class: 'grid-rows-table'})
		g.rows_height_div = H.div({class: 'grid-rows-height-div'}, g.rows_table)
		g.rows_view_div = H.div({class: 'grid-rows-div'}, g.rows_height_div)
		g.grid_div = H.div({class: 'grid-div'}, g.header_table, g.rows_view_div)

		for (let field of fields) {

			let sort_icon  = H.div({class: 'fa grid-sort-icon'})
			let title_table = lr_table(field.name, sort_icon, field.align == 'right')

			function toggle_order(e) {
				if (g.col_resize)
					return

				if (e.which == 3)  // right-click
					g.clear_order()
				else
					g.toggle_order(field, e.shiftKey)
				e.preventDefault()
			}

			let th = H.th({class: 'grid-header-th'}, title_table)

			th.field = field
			th.sort_icon = sort_icon

			if (field.w) th.w = field.w
			if (field.max_w) th.max_w = field.max_w
			if (field.min_w) th.min_w = field.min_w
			th.field = field
			th.on('mousedown', toggle_order)
			th.on('contextmenu', function(e) { e.preventDefault() })

			g.header_tr.add(th)
		}
		g.header_table.add(g.header_tr)

		g.parent.set1(g.grid_div)

		init_geometry()

		g.rows_height_div.h = g.rows_h
		g.rows_view_div.h = g.rows_view_h
		g.grid_div.w = g.w

		for (let i = 0; i < visible_row_count(); i++) {

			let tr = H.tr({class: 'grid-tr'})

			for (let i = 0; i < fields.length; i++) {
				let th = g.header_tr.at[i]
				let field = fields[i]

				let td = H.td({class: 'grid-td'})

				td.w = th.clientWidth
				td.h = g.row_h
				td.style['border-bottom-width'] = g.row_border_h + 'px'

				td.on('mousedown', function() {
					if (g.col_resize)
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

			g.rows_table.add(tr)
		}

		g.rows_view_div.on('scroll', function(e) {
			render_rows()
			g.header_table.x = -e.target.scrollLeft
		})

		size_rows()

		g.sort()
	}

	g.row_tr = function(row) {
		return trs.get(row)
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
		} else
			g.focus_near_cell(0, 0, false)
	}

	// make columns resizeable ------------------------------------------------

	let hit_td, hit_x

	function mousedown(e) {
		if (g.col_resizing || !hit_td)
			return
		g.col_resizing = true
		g.grid_div.class('col-resizing', true)
		e.preventDefault()
	}

	function mouseup(e) {
		g.col_resizing = false
		g.grid_div.class('col-resizing', false)
		g.col_resize = false
	}

	function size_rows() {
		return
		for (let td of g.header_tr.children)
			size_rows_for(td.index, td.clientWidth)
	}

	function size_row(tr) {
		return
		let ths = g.header_tr.children
		for (let i = 0; i < ths.length; i++) {
			let th = ths[i]
			let td = tr.at[i]
			td.w = th.clientWidth
		}
	}

	function size_rows_for(td_index, w) {
		for (let tr of g.rows_table.children) {
			let td = tr.at[td_index]
			td.w = w
		}
	}

	function mousemove(e) {
		if (g.col_resizing) {
			hit_td.w = e.clientX - (g.rows_table.offsetLeft + hit_td.offsetLeft + hit_x)
			size_rows_for(hit_td.index, hit_td.clientWidth)
			e.preventDefault()
		} else {
			hit_td = null
			for (td of g.header_tr.children) {
				hit_x = e.clientX - (g.rows_table.offsetLeft + td.offsetLeft + td.offsetWidth)
				if (hit_x >= -5 && hit_x <= 5) {
					hit_td = td
					break
				}
			}
			let old_col_resize = g.col_resize
			g.col_resize = !!hit_td
			g.grid_div.class('col-resize', g.col_resize)
		}
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
			tr || g.rows_table.first,
			rows >= 0 && 'next' || 'prev',
			function(tr) { return true },
			function(tr) {
				let stop = !rows
				rows -= sign(rows)
				return stop
			})
		let td1 = find_sibling(
			tr1 && (td && tr1.at[td.index] || tr1.first),
			cols >= 0 && 'next' || 'prev',
			function(td) { return !td.hasclass('read_only') },
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
		if (tr != g.focused_tr) {
			if (!g.exit_row())
				return false
		} else if (!g.exit_edit())
			return false
		if (g.focused_tr) g.focused_tr.class('focused', false)
		if (g.focused_td) g.focused_td.class('focused', false)
		if (tr) tr.class('focused', true)
		if (td) td.class('focused', true)
		if (scrollintoview !== false && (td || tr))
			(td || tr).scrollintoview()
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

	/*

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
	*/

	function input_focusout(e) {
		g.exit_edit()
		return
	}

	// NOTE: input even is not cancellable.
	function input_input(e) {
		let td = g.focused_td
		let tr = g.focused_tr
		td.class('unsaved', true)
		td.class('modified', true)
		tr.class('modified', true)
		td.class('invalid', false)
		tr.class('invalid', false)
		tr.class('invalid_values', false)
		g.tooltip(td, false)
		g.tooltip(tr, false)
		if (g.save_cell_on == 'input')
			if (!g.save_cell(g.focused_td))
				return
		if (g.save_row_on == 'input')
			if (!g.save_row(g.focused_tr))
				return
	}

	function td_input(td) {
		return td.first
	}

	g.enter_edit = function(where) {
		if (g.input)
			return false
		let td = g.focused_td
		let input = td && td_input(td)
		if (!input)
			return false
		g.input = input
		td.class('editing', true)
		input.attr('disabled', null)
		input.focus()
		input.on('focusout', input_focusout)
		input.on('input', input_input)
		if (where == 'right')
			input.select(g.input.value.length, input.value.length)
		else if (where == 'left')
			input.select(0, 0)
		else if (where)
			input.select(0, input.value.length)
		return true
	}

	g.exit_edit = function() {
		let input = g.input
		if (!input)
			return true
		let td = g.focused_td
		if (g.save_cell_on == 'exit_edit')
			g.save_cell(g.focused_td)
		if (g.save_row_on == 'exit_edit')
			g.save_row(g.focused_tr)
		if (g.prevent_exit_edit)
			if (g.focused_td.hasclass('invalid'))
				return false
		input.off('focusout', input_focusout)
		input.off('input', input_input)
		input.select(0, 0)
		input.attr('disabled', true)
		td.class('editing', false)
		g.input = null
		return true
	}

	g.exit_row = function() {
		let tr = g.focused_tr
		if (!tr)
			return true
		let td = g.focused_td
		if (g.save_row_on == 'exit_row')
			g.save_row(tr)
		if (g.prevent_exit_row)
			if (tr.hasclass('invalid_values') || tr.hasclass('invalid'))
				return false
		if (!g.exit_edit())
			return false
		return true
	}

	// saving -----------------------------------------------------------------

	function no_child_has_class(e, classname) {
		for (let c of e.children)
			if (c.hasclass(classname))
				return false
		return true
	}

	g.tooltip = function(e, msg) {
		// let div = H.div({class: 'grid-error'}, msg)
		e.title = msg || ''
	}

	g.save_cell = function(td) {
		if (!td.hasclass('unsaved'))
			return !td.hasclass('invalid')
		let tr = td.parent
		let row = tr.row
		let field = fields[td.index]
		let input = td_input(td)
		let ret = d.set_value(row, field, input.value)
		let ok = ret === true
		td.class('unsaved', false)
		td.class('invalid', !ok)
		tr.class('invalid_values', !no_child_has_class(tr, 'invalid'))
		if (ok)
			tr.class('unsaved', true)
		g.tooltip(td, !ok && ret)
		return ok
	}

	g.save_row = function(tr) {
		if (!tr.hasclass('unsaved'))
			return !tr.hasclass('invalid')
		for (td of tr.children)
			if (!g.save_cell(td))
				return false
		let ret = d.save_row(tr.row)
		let ok = ret === true
		tr.class('unsaved', false)
		tr.class('saving', ok)
		tr.class('invalid', !ok)
		g.tooltip(tr, !ok && ret)
		return ok
	}

	g.revert_cell = function(td) {
		let row = td.parent.row
		let field = fields[td.index]
		let input = td_input(td)
		input.value = d.value(row, field)
	}

	// adding & removing rows -------------------------------------------------

	g.insert_row = function(add) {
		if (!d.can_add_rows)
			return
		if (!g.focus_cell())
			return
		let field_index = g.focused_td && g.focused_td.index
		let reenter_edit = g.input && g.keep_editing
		let row = d.add_row()
		let tr = render_row(row)
		if (add || !g.focused_tr)
			g.tbody.add(tr)
		else
			g.tbody.insertBefore(tr, g.focused_tr)
		size_row(tr)
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
		let tr = row_tr(row)
		let td = field_td(field)
		let input = td_input(td)
		input.value = val
	}

	g.row_added = function(e, row) {
		let tr = render_row(row)
		g.tbody.add(tr)
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
			&& g.focused_tr == g.tbody.last
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

		// Esc: revert cell edits or row edits.
		if (e.key == 'Escape') {
			g.exit_edit()
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

	// sorting ----------------------------------------------------------------

	let order_by_dir

	function init_order_by() {
		let order_by = g.order_by || ''
		delete g.order_by
		property(g, 'order_by', {
			get: function() {
				let a = []
				for (let [field, dir] of order_by_dir) {
					a.push(field.name + (dir == 'asc' ? '' : ' desc'))
				}
				return a.join(', ')
			},
			set: function(s) {
				order_by_dir = new Map()
				let ea = s.split(/\s*,\s*/)
				for (let e of ea) {
					let m = e.match(/^([^\s]*)\s*(.*)$/)
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
		dir = dir == 'asc' ? 'desc' : 'asc'
		if (!keep_others)
			order_by_dir.clear()
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
			s.push('if (!r1.row) return -1')
			s.push('if (!r2.row) return  1')
			// invalid values come first
			s.push('var v1 = !(r1.fields && r1.fields['+i+'].invalid)')
			s.push('var v2 = !(r2.fields && r2.fields['+i+'].invalid)')
			s.push('if (v1 < v2) return -1')
			s.push('if (v1 > v2) return  1')
			// modified values come second
			s.push('var v1 = !(r1.fields && r1.fields['+i+'].modified)')
			s.push('var v2 = !(r2.fields && r2.fields['+i+'].modified)')
			s.push('if (v1 < v2) return -1')
			s.push('if (v1 > v2) return  1')
			// compare values using the dataset comparator
			s.push('var cmp = cmps['+i+']')
			s.push('var r = cmp(r1.row, r2.row, '+i+')')
			s.push('if (r) return r * '+r)
		}
		s.push('return 0')
		s = 'let f = function(r1, r2) {\n\t' + s.join('\n\t') + '\n}; f'
		let cmp = eval(s)
		g.rows.sort(cmp)

		render_rows()
		update_sort_icons()

	}

	init()

	return g
}

