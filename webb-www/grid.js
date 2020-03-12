/*
	Grid/TreeList Widget.
	Written by Cosmin Apreutesei. Public Domain.

*/

// box scroll-to-view box. from box2d.lua.
function box2d_scroll_to_view(x, y, w, h, pw, ph, sx, sy) {
	let min_sx = -x
	let min_sy = -y
	let max_sx = -(x + w - pw)
	let max_sy = -(y + h - ph)
	return [
		min(max(sx, min_sx), max_sx),
		min(max(sy, min_sy), max_sy)
	]
}

function grid(...options) {

	let g = {
		// geometry
		w: 500,
		h: 400,
		row_h: 24,
		row_border_h: 0,
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

	function init() {
		update(g, ...options)
		d = g.dataset
		init_fields()
		init_order_by()
		reload()
		hook_unhook_events(true)
	}

	function init_fields() {
		fields = []
		if (g.cols) {
			for (let fi of g.cols)
				if (!d.fields[fi].hidden)
					fields.push(d.fields[fi])
		} else {
			for (let field of d.fields)
				if (!field.hidden)
					fields.push(field)
		}
	}

	function hook_unhook_events(on) {
		document.onoff('keydown'  , keydown  , on)
		document.onoff('keypress' , keypress , on)
		document.onoff('mousedown', mousedown, on)
		document.onoff('mouseup'  , mouseup  , on)
		document.onoff('mousemove', mousemove, on)
		d.onoff('reload'       , reload       , on)
		d.onoff('value_changed', value_changed, on)
		d.onoff('row_added'    , row_added    , on)
		d.onoff('row_removed'  , row_removed  , on)
	}

	g.free = function() {
		hook_unhook_events(false)
	}

	// virtual grid geometry --------------------------------------------------

	function set_scroll_y(sy) {
		g.scroll_y = clamp(sy, 0, max(0, g.rows_h - g.rows_view_h))
	}

	function make_visible(cell) {
		let [ri, fi] = cell
		if (ri == null)
			return
		let view = g.rows_view_div
		let th = fi != null && g.header_tr.at[fi]

		let h = g.row_h
		let y = h * ri
		let x = th ? th.offsetLeft  : 0
		let w = th ? th.clientWidth : 0

		let pw = view.clientWidth
		let ph = view.clientHeight

		let sx0 = view.scrollLeft
		let sy0 = view.scrollTop

		let [sx, sy] = box2d_scroll_to_view(x, y, w, h, pw, ph, -sx0, -sy0)

		set_scroll_y(-sy)
		view.scroll(-sx, -sy)
	}

	function first_visible_row(sy) {
		return floor(sy / g.row_h)
	}

	function rows_y_offset(sy) {
		return floor(sy - sy % g.row_h)
	}

	function init_heights() {
		g.rows_h = g.row_h * g.rows.length - floor(g.row_border_h / 2)
		g.rows_view_h = g.h - g.header_table.clientHeight
		g.rows_height_div.h = g.rows_h
		g.rows_view_div.h = g.rows_view_h
		g.visible_row_count = floor(g.rows_view_h / g.row_h) + 2
	}

	function tr_at(ri) {
		let sy = g.scroll_y
		let i0 = first_visible_row(sy)
		let i1 = i0 + g.visible_row_count
		return g.rows_table.at[ri - i0]
	}

	function cell_at(cell) {
		let [ri, fi] = cell
		let tr = ri != null && tr_at(ri)
		return [tr, tr && fi != null ? tr.at[fi] : null]
	}

	// rendering --------------------------------------------------------------

	function create_row(row) {
		return {row: row}
	}

	function init_rows() {
		g.rows = []
		for (let i = 0; i < d.rows.length; i++)
			if (!d.rows[i].removed)
				g.rows.push(create_row(d.rows[i]))
	}

	function find_ri(row) {
		for (let i = 0; i < g.rows.length; i++)
			if (g.rows[i].row == row)
				return i
	}

	function update_row(tr, ri) {
		let row = g.rows[ri]
		tr.row = row
		tr.row_index = ri
		for (let fi = 0; fi < fields.length; fi++) {
			let field = fields[fi]
			let td = tr.at[fi]
			td.field = field
			td.field_index = fi
			if (row) {
				td.innerHTML = d.value(row.row, field)
				td.class('read-only', !d.can_change_value(row.row, field))
				td.class('not-focusable', !d.can_be_focused(row.row, field))
				td.style.display = null
			} else {
				td.innerHTML = ''
				td.style.display = 'none'
			}
		}
	}

	function update_rows() {
		let sy = g.scroll_y
		let i0 = first_visible_row(sy)
		g.rows_table.y = rows_y_offset(sy)
		let n = g.visible_row_count
		for (let i = 0; i < n; i++) {
			let tr = g.rows_table.at[i]
			update_row(tr, i0 + i)
		}
	}

	function render() {

		g.header_tr = H.tr()
		g.header_table = H.table({class: 'grid-header-table'}, g.header_tr)
		g.rows_table = H.table({class: 'grid-rows-table'})
		g.rows_height_div = H.div({class: 'grid-rows-height-div'}, g.rows_table)
		g.rows_view_div = H.div({class: 'grid-rows-div'}, g.rows_height_div)
		g.grid_div = H.div({class: 'grid-div', tabindex: '0'}, g.header_table, g.rows_view_div)
		g.grid_div.on('mousemove', grid_div_mousemove)

		for (let field of fields) {

			let sort_icon  = H.div({class: 'fa grid-sort-icon'})
			let e1 = H.td({class: 'grid-header-title-td'}, field.name)
			let e2 = H.td({class: 'grid-header-sort-icon-td'}, sort_icon)
			if (field.align == 'right')
				[e1, e2] = [e2, e1]
			e1.attr('align', 'left')
			e2.attr('align', 'right')
			let title_table =
				H.table({class: 'grid-header-th-table'},
					H.tr(0, e1, e2))

			let th = H.th({class: 'grid-header-th'}, title_table)

			th.field = field
			th.sort_icon = sort_icon

			if (field.w) th.w = field.w
			if (field.max_w) th.max_w = field.max_w
			if (field.min_w) th.min_w = max(10, field.min_w)

			th.on('mousedown', header_cell_mousedown)
			th.on('contextmenu', function(e) { e.preventDefault() })

			g.header_tr.add(th)
		}
		g.header_table.add(g.header_tr)

		g.parent.set1(g.grid_div)

		init_heights()

		g.grid_div.w = g.w

		for (let i = 0; i < g.visible_row_count; i++) {

			let tr = H.tr({class: 'grid-tr'})

			for (let i = 0; i < fields.length; i++) {
				let th = g.header_tr.at[i]
				let field = fields[i]
				let td = H.td({class: 'grid-td'})
				td.w = th.clientWidth
				td.h = g.row_h
				td.style['border-bottom-width'] = g.row_border_h + 'px'
				td.on('mousedown', cell_mousedown)
				tr.add(td)
			}

			g.rows_table.add(tr)
		}

		g.rows_view_div.on('scroll', function() { scroll() })

		sort()
	}

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

	function set_focus(set) {
		let [tr, td] = cell_at(g.focused_cell)
		if (tr) tr.class('focused', set)
		if (td) td.class('focused', set)
	}

	function update_row_width(td_index, w) {
		for (let tr of g.rows_table.children) {
			let td = tr.at[td_index]
			td.w = w
		}
	}

	function update_header_x(sx) {
		g.header_table.x = -sx
	}

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

	function scroll(sy, sx) {
		if (sy == null) sy = g.rows_view_div.scrollTop
		if (sx == null) sx = g.rows_view_div.scrollLeft
		set_focus(false)
		set_scroll_y(sy)
		update_rows()
		set_focus(true)
		update_header_x(sx)
	}

	function reload() {
		g.focused_cell = [null, null]
		init_rows()
		render()
		g.focus_cell(null, 0, 0, false)
	}

	// make columns resizeable ------------------------------------------------

	let hit_th, hit_x

	function mousedown(e) {
		if (g.grid_div.hasclass('col-resizing') || !hit_th)
			return
		focus()
		g.grid_div.class('col-resizing', true)
		e.preventDefault()
	}

	function mouseup(e) {
		g.grid_div.class('col-resizing', false)
	}

	function grid_div_mousemove(e) {
		if (g.grid_div.hasclass('col-resizing'))
			return
		hit_th = null
		for (th of g.header_tr.children) {
			hit_x = e.clientX - (g.header_table.offsetLeft + th.offsetLeft + th.offsetWidth)
			if (hit_x >= -5 && hit_x <= 5) {
				hit_th = th
				break
			}
		}
		g.grid_div.class('col-resize', hit_th != null)
	}

	function mousemove(e) {
		if (!g.grid_div.hasclass('col-resizing'))
			return
		let field = fields[hit_th.index]
		let w = e.clientX - (g.header_table.offsetLeft + hit_th.offsetLeft + hit_x)
		let min_w = max(20, field.min_w || 0)
		let max_w = max(min_w, field.max_w || 1000)
		hit_th.w = clamp(w, min_w, max_w)
		update_row_width(hit_th.index, hit_th.clientWidth)
		e.preventDefault()
	}

	// focusing ---------------------------------------------------------------

	function is_focused() {
		return document.activeElement == g.grid_div
	}

	function focus() {
		g.grid_div.focus()
	}

	g.focused_cell = [null, null]

	g.first_focusable_cell = function(cell, rows, cols, for_editing) {
		if (cell == false) // explicit remove focus
			return [null, null, true]
		rows = rows || 0
		cols = cols || 0
		let [ri, fi] = (cell || g.focused_cell) // null cell means focused cell
		let move_row = rows != 0
		let move_col = cols != 0
		let start_ri = ri
		let start_fi = fi

		ri = ri || 0
		fi = fi || 0

		let last_valid_ri = null
		let last_valid_fi = null
		let last_valid_row

		let r_inc = sign(rows)
		while (ri >= 0 && ri < g.rows.length) {
			let row = g.rows[ri].row
			let focusable = d.can_be_focused(row)
			if (focusable && for_editing)
				focusable = d.can_change_value(row)
			if (focusable) {
				last_valid_ri = ri
				last_valid_row = row
				if (!rows) break
				rows -= r_inc
			}
			ri += r_inc
		}
		if (last_valid_ri == null)
			return [null, null, false]

		let row_moved = !move_row || last_valid_ri != start_ri

		// if couldn't move row, don't move col either.
		if (!row_moved) {
			move_col = false
			cols = 0
		}

		let f_inc = sign(cols)
		while (fi >= 0 && fi < fields.length) {
			let field = fields[fi]
			let focusable = d.can_be_focused(last_valid_row, field)
			if (focusable && for_editing)
				focusable = d.can_change_value(last_valid_row, field)
			if (focusable) {
				last_valid_fi = fi
				if (!cols) break
				cols -= f_inc
			}
			fi += f_inc
		}

		let col_moved = !move_col || last_valid_fi != start_fi

		return [last_valid_ri, last_valid_fi, row_moved || col_moved]
	}

	g.focus_cell = function(cell, rows, cols, make_it_visible, for_editing) {
		let c1 = g.first_focusable_cell(cell, rows, cols, for_editing)
		let c0 = g.focused_cell
		if (c1[0] == c0[0] && c1[1] == c0[1])
			return false
		if (c1[0] != c0[0])  {
			if (!g.exit_row())
				return false
		} else if (!g.exit_edit())
			return false
		set_focus(false)
		if (make_it_visible != false)
			make_visible(c1)
		g.focused_cell = c1
		set_focus(true)
		return true
	}

	g.focus_next_cell = function(cols, auto_advance_row, make_it_visible, for_editing) {
		return g.focus_cell(null, 0, cols, make_it_visible, for_editing)
			|| ((auto_advance_row || g.auto_advance_row)
				&& g.focus_cell(null, cols, cols * -1/0, make_visible))
	}

	function on_last_row() {
		let [ri, fi, moved] = g.first_focusable_cell(null, 1)
		return !moved
	}

	function focused_row() {
		let [ri] = g.focused_cell
		return ri != null ? g.rows[ri] : null
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
		let ret = d.set_value(row, field, input.value, g)
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

	g.insert_row = function() {
		let row = d.add_row(g)
		return row != null
	}

	g.add_row = function() {
		g.focus_cell(false)
		return g.insert_row()
	}

	g.remove_row = function(ri) {
		let row = g.rows[ri]
		return d.remove_row(row.row, g)
	}

	g.remove_focused_row = function() {
		let [ri, fi] = g.focused_cell
		if (ri == null)
			return false
		if (!g.remove_row(ri))
			return false
		ri = clamp(ri, 0, g.rows.length-1)
		if (!g.focus_cell([ri, fi]))
			if (g.focus_cell([ri, fi], -1))
		return true
	}

	// updating from dataset changes ------------------------------------------

	function value_changed(row, field, val, source) {
		let ri = find_ri(row)
		//
	}

	function row_added(row, source) {
		row = create_row(row)
		set_focus(false)
		if (source == g) {
			let reenter_edit = g.input && g.keep_editing
			let [ri] = g.focused_cell
			if (ri == null) {
				ri = g.rows.length
				g.focused_cell[0] = ri // move focus to added row.
			}
			g.rows.insert(ri, row)
			init_heights()
			scroll()
			if (reenter_edit)
				g.enter_edit(true)
		} else {
			g.rows.push(row)
			init_heights()
			sort()
		}
	}

	function row_removed(row, source) {
		let ri = find_ri(row)
		if (ri == null)
			return
		set_focus(false)
		if (g.focused_cell[0] == ri) {
			// removing the focused row: unfocus it.
			g.exit_edit(true)
			g.focus_cell(false)
		} else if (g.focused_cell[0] > ri) {
			// adjust focused row index to account for the removed row.
			g.focused_cell[0]--
		}
		g.rows.remove(ri)
		init_heights()
		scroll()
	}

	// mouse boundings --------------------------------------------------------

	function header_cell_mousedown(e) {
		if (g.grid_div.hasclass('col-resize'))
			return
		if (e.which == 3)  // right-click
			g.clear_order()
		else
			g.toggle_order(this.field, e.shiftKey)
		e.preventDefault()
	}

	function cell_mousedown(e) {
		if (g.grid_div.hasclass('col-resize'))
			return
		let ri = this.parent.row_index
		let fi = this.field_index
		if (g.focused_cell[0] == ri && g.focused_cell[1] == fi)
			g.enter_edit()
		else
			g.focus_cell([ri, fi])
	}

	// key bindings -----------------------------------------------------------

	function keydown_key(key, shift) {

		// Arrows: horizontal navigation.
		if (key == 'ArrowLeft' || key == 'ArrowRight') {

			let cols = key == 'ArrowLeft' ? -1 : 1

			let reenter_edit = g.input && g.keep_editing

			let move = !g.input
				|| (g.auto_jump_cells && !shift
					&& g.input.caret == (cols < 0 ? 0 : g.input.value.length))

			if (move && g.focus_next_cell(cols)) {
				if (reenter_edit)
					g.enter_edit(cols > 0 ? 'left' : 'right')
				return
			}
		}

		// Tab/Shift+Tab cell navigation.
		if (key == 'Tab') {

			let cols = shift ? -1 : 1

			let reenter_edit = g.input && g.keep_editing

			if (g.focus_next_cell(cols, true))
				if (reenter_edit)
					g.enter_edit(cols > 0 ? 'left' : 'right')

			return
		}

		// insert with the arrow down key on the last focusable row.
		if (key == 'ArrowDown') {
			if (on_last_row())
				if (g.add_row())
					return
		}

		// remove last row with the arrow up key if not edited.
		if (key == 'ArrowUp') {
			if (on_last_row()) {
				let row = focused_row()
				if (row && row.row.is_new && !row.modified) {
					g.remove_focused_row()
					return
				}
			}
		}

		// vertical navigation.
		if (  key == 'ArrowDown' || key == 'ArrowUp'
			|| key == 'PageDown'  || key == 'PageUp'
			|| key == 'Home'      || key == 'End'
		) {
			let rows
			switch (key) {
				case 'ArrowUp'   : rows = -1; break
				case 'ArrowDown' : rows =  1; break
				case 'PageUp'    : rows = -g.page_rows; break
				case 'PageDown'  : rows =  g.page_rows; break
				case 'Home'      : rows = -1/0; break
				case 'End'       : rows =  1/0; break
			}

			let reenter_edit = g.input && g.keep_editing

			if (g.focus_cell(null, rows)) {
				if (reenter_edit)
					g.enter_edit(true)
				return
			}
		}

		// F2: enter edit mode
		if (!g.input && key == 'F2') {
			g.enter_edit(true)
			return
		}

		// Enter: toggle edit mode, and navigate on exit
		if (key == 'Enter') {
			if (!g.input) {
				g.enter_edit(true)
			} else if (g.exit_edit()) {
				if (g.auto_advance == 'next_row') {
					if (g.focus_cell(null, 1))
						if (g.keep_editing)
							g.enter_edit(true)
				} else if (g.auto_advance == 'next_cell')
					if (g.focus_next_cell(1))
						if (g.keep_editing)
							g.enter_edit(true)
			}
			return
		}

		// Esc: revert cell edits or row edits.
		if (key == 'Escape') {
			g.exit_edit()
			return
		}

		// insert key: insert row
		if (key == 'Insert') {
			g.insert_row()
			return
		}

		// delete key: delete active row
		if (!g.input && key == 'Delete') {
			if (g.remove_focused_row())
				return
		}

		return true
	}

	function keydown(e) {
		if (is_focused())
			if (!keydown_key(e.key, e.shiftKey))
				e.preventDefault()
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
		sort()
	}

	g.clear_order = function() {
		order_by_dir.clear()
		sort()
	}

	function sort() {

		if (!order_by_dir.size) {
			update_sort_icons()
			scroll()
			return
		}

		let ri = g.focused_cell[0]
		let focused_row = ri != null && g.rows[ri].row
		set_focus(false)

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

		if (focused_row) {
			g.focused_cell[0] = find_ri(focused_row)
			make_visible(g.focused_cell)
			set_focus(true)
		}

		update_sort_icons()
		scroll()
	}

	init()

	return g
}

