/*
	Grid/TreeList Widget.
	Written by Cosmin Apreutesei. Public Domain.

	--

*/

grid = (function() {

// helpers -------------------------------------------------------------------

// check if the text in an input box is fully selected.
function fully_selected(input) {
	if (!input) return
	var p0 = input[0].selectionStart
	var p1 = input[0].selectionEnd
	return p0 == 0 && p1 == input.val().length
}

// grid ----------------------------------------------------------------------

var active_grid // the grid that gets keyboard input

function grid(g_opt) {

	var g = {
		// built-in rendering
		container: null,            // rendering container selector
		context: {},                // rendering context
		grid_template: 'grid',      // rendering template for grid
		rows_template: 'grid_rows', // rendering template for rows
		// custom rendering
		grid: null,                 // grid selector
		// tree aspect
		tree_field: null,
		// behavior
		page_rows: 20,              // how many rows to move on page-down/page-up
		immediate_mode: false,      // stay in edit mode while navigating
		save_on_exit_row: true,     // trigger save on vertical movement
		save_on_exit_edit: false,   // trigger save when done editing each cell
	}

	var d

	// rendering --------------------------------------------------------------

	var format_value = function(v, field, row) {
		return (v === null) ? 'null' : v
	}
	g.format_value = format_value

	var value_type = function(v) {
		return v === null ? 'null' : (typeof v)
	}
	g.value_type = value_type

	g.render_context = function() {

		var t = update({}, g.context)
		var ri = -1
		var ci
		var val = {}
		var row

		var ft = []
		for (var ci = 0; ci < d.fieldcount(); ci++) {
			var f = update({
				index: ci,
				align: 'left',
			}, d.field(ci))
			f['align_'+f.align] = true
			ft.push(f)
		}

		t.fields = ft
		t.rows = []
		t.rows.length = d.rowcount() // hack

		t.cols = function() {
			ri++
			row = d.row(ri)
			ci = 0
			return ft
		}

		t.col = function() {
			val.field = d.field(ci)
			val.raw = d.val(ri, ci)
			ci++
			return val
		}

		val.value = function() { return format_value(val.raw, val.field, row); }
		val.type = function() { return value_type(val.raw); }
		val.readonly = function() { return val.field.readonly ? 'readonly' : ''; }
		val.align = function() { return val.field.align; }

		val.tree_field = function() { return val.field.name == g.tree_field; }
		val.indent = function() { return 16 + row.level * 20; }
		val.expanded_dir = function() { return row.childcount ? (row.expanded ? 'down' : 'right') : '' }

		return t
	}

	g.template = function(name) {
		return $('#' + name + '_template').html()
	}

	g.render_template = function(template, values) {
		var ctx = g.render_context(values)
		return Mustache.render(g.template(template), ctx, g.template)
	}

	g.render = function() {
		var container = $(g.container)
		assert(container.length == 1, 'container not found')
		var s = g.render_template(g.grid_template, d.rows)
		container.html(s)
		init_selectors()
		make_clickable()
	}

	g.error = function(message) {
		alert(message)
	}

	// selectors --------------------------------------------------------------

	g.rowcount = function() { return d.rowcount(); }
	g.colcount = function() { return d.fieldcount(); }

	g.rows_ct = function() {
		return g.grid.find('.rows');
	}

	var rows
	var rowsel
	var cells
	var cellsel
	var allcells

	function init_selectors() {
		g.grid = $(g.container).find('.grid')
		rows = g.grid.find('.row')
		rowsel = []
		cellsel = []
		cells = []
		for (var ri = 0; ri < rows.length; ri++) {
			var rs = $(rows[ri])
			rowsel[ri] = rs
			var cl = rs.find('.cell')
			cells[ri] = cl
			var cs = []
			cellsel[ri] = cs
			for (var ci = 0; ci < cl.length; ci++)
				cs[ci] = $(cl[ci])
		}
		allcells = g.grid.find('.cell')
	}

	g.rows = function() { return rows; }
	g.row = function(ri) {
		ri = clamp(ri, 0, g.rowcount() - 1)
		return rowsel[ri]
	}
	g.cells = function(row) {
		return row ? cells[row.index()] : allcells
	}

	g.cell = function(ri, ci) {
		if (typeof ri != 'number')
			ri = ri.index()
		ri = clamp(ri, 0, g.rowcount() - 1)
		ci = clamp(ci, 0, g.colcount() - 1)
		return cellsel[ri][ci]
	}

	g.rowof = function(cell) {
		return cell.parent()
	}

	g.hcells = function() { return g.grid.find('.field'); }
	g.hcell = function(ci) { return g.grid.find('.field:nth-child('+(ci+1)+')'); }
	g.vcells = function(ci) {
		return g.grid.find('.field:nth-child('+(ci+1)+'),.cell:nth-child('+(ci+1)+')')
	}

	// cell values ------------------------------------------------------------

	g.val = function(cell) {
		cell = $(cell)
		var ci = cell.index()
		var ri = g.rowof(cell).index()
		return d.val(ri, ci)
	}

	g.oldval = function(cell) {
		cell = $(cell)
		var ci = cell.index()
		var ri = g.rowof(cell).index()
		return d.oldval(ri, ci)
	}

	g.setval = function(cell, val) {
		var curval = g.val(cell)
		if (val === curval) return true
		var ci = cell.index()
		var ri = g.rowof(cell).index()
		if (val === '')
			val = null
		try {
			val = d.setval(ri, ci, val)
		} catch (e) {
			if (!(e instanceof d.ValidationError))
				throw e
			g.error(e.message)
			return
		}
		var v = cell.find('.value')
		v.html(g.format_value(val, d.field(ci)))
		v.removeClass('null string number boolean')
		v.addClass(g.value_type(val))
		return true
	}

	// grid selection ---------------------------------------------------------

	g.active_grid = function() { return active_grid; }
	g.active = function() { return active_grid == g; }

	g.deactivate = function() {
		if (!g.active()) return true
		if (!g.exit_edit()) return
		g.grid.removeClass('active')
		active_grid = null
		return true
	}

	g.activate = function() {
		if (g.active()) return true
		if (active_grid && !active_grid.deactivate())
			return
		g.grid.addClass('active')
		active_grid = g
		return true
	}

	// row selection ----------------------------------------------------------

	g.selected_rows = function() { g.grid.find('.row.selected'); }
	g.deselect_rows = function(rows) { rows.removeClass('selected'); }
	g.select_rows = function(rows) { rows.addClass('selected'); }

	// row focusing -----------------------------------------------------------

	var active_row

	g.deactivate_row = function() {
		if (!g.deactivate_cell()) return
		if (!g.exit_row(active_row)) return
		var row = active_row
		row.removeClass('active')
		g.deselect_rows(row)
		active_row = $([])
		return row
	}

	g.activate_row = function(row) {
		row = $(row)
		if (!row.length) return // no row
		if (active_row.is(row)) return // same row
		var prev_row = g.deactivate_row()
		if (!prev_row) return
		g.select_rows(row)
		row.addClass('active')
		active_row = row
		return prev_row
	}

	g.active_row = function(row) {
		if (!row) return active_row
		return g.activate_row(row)
	}

	// cell focusing ----------------------------------------------------------

	var active_cell

	g.deactivate_cell = function() {
		if (!g.exit_edit()) return
		var cell = active_cell
		cell.removeClass('active')
		active_cell = $([])
		return cell
	}

	g.activate_cell = function(cell) {
		if (!g.activate()) return
		cell = $(cell)
		if (!cell.length) return // no cell
		if (active_cell.is(cell)) return true // same cell
		if (!g.rowof(cell).is(g.active_row())) { // diff. row
			if (!g.activate_row(g.rowof(cell)))
				return
		} else { // same row
			if(!g.deactivate_cell())
				return
		}
		cell.addClass('active')
		cell.scrollintoview({duration: 0})
		active_cell = cell
		return true
	}

	g.active_cell = function() { return active_cell; }

	// cell editing -----------------------------------------------------------

	var active_input

	g.input = function() { return active_input; }
	g.caret = function(caret) {
		if (!active_input) return
		if (caret == null)
			return active_input.caret_pos
		active_input.caret_pos = caret
	}
	g.focused = function() {
		if (!active_input) return
		return active_input.is(':focus')
	}

	g.enter_edit = function(caret, select) {
		if (active_input)
			return active_input
		var cell = active_cell
		if (!cell.length) return
		var field = d.field(cell.index())
		if (field.readonly) return
		var val = g.val(cell)
		var div = cell.find('.input_div')
		var w = div.parent().width()
		var h = cell.height()
		div.html('<input type=text class=input'+
			(field.maxlength ? ' maxlength='+field.maxlength : '')+
			' style="width: '+w+'px; height: '+h+'px; text-align: '+field.align+'">')
		var input = div.find('input')
		input.val(val)
		input.focus()
		if (caret != null)
			input.caret_pos = caret
		if (select)
			input.select()
		input.focusout(function() {
			g.exit_edit()
		})
		active_cell.addClass('edit')
		active_input = input
		return input
	}

	g.exit_edit = function(cancel) {
		if (!active_input)
			return true
		var cell = active_cell
		if (!cancel) {
			var ci = active_cell.index()
			var curval = g.val(active_cell)
			if (!g.setval(cell, active_input.val().trim()))
				return false
			var newval = g.val(active_cell)
			if (newval !== curval) {
				cell.removeClass('rejected corrected')
				var oldval = g.oldval(active_cell)
				if (newval !== oldval) {
					if (!cell.hasClass('changed')) {
						cell.addClass('changed')
						cell.data('oldval', curval)
						cell.attr('title', 'old value: '+g.format_value(curval, d.field(ci)))
					}
				}
				else
					cell.removeClass('changed')
				// even if the cell just got reverted back to its old value,
				// the row gets marked as changed anyway, because other cells
				// might still be in rejected state.
				g.rowof(cell).addClass('changed')
			}
		}
		cell.removeClass('edit')
		cell.find('.input_div').html('')
		active_input = null
		g.quick_edit = null
		return g.save_on_exit_edit ? g.save_values() : true
	}

	g.insert_row = function(ri) {

		// range-check or infer row index.
		if (ri == null)
			ri = g.active_row().index()
		ri = clamp(ri, 0, g.rowcount())
		var append = ri == g.rowcount()

		// add it to dataset
		var row = d.insert(ri)

		// render it, add it to position, and get it
		var s = g.render_template(g.rows_template, [row])
		if (append)
			g.rows_ct().append(s)
		else
			g.row(ri).before(s)

		var row = g.row(ri)
		var cells = g.cells(row)

		// activate the row on the same cell as before
		g.activate_cell(g.cell(row, g.active_cell().index()))

		// mark the cells and the row as changed/new.
		g.cells().each(function(_, cell) {
			cell = $(cell)
			var field = d.field(cell.index())
			if (field.client_default != null)
				cell.addClass('changed')
		})
		cells.addClass('new')
		row.addClass('new changed')

		g.render()
	}

	g.delete_row = function(ri) {

		// range-check & set default row index
		if (ri == null)
			ri = g.active_row().index()
		if (ri < 0 || ri >= g.rowcount())
			return

		var row = g.row(ri)
		var ci = g.active_cell().index()

		// deactivate row
		if (g.active_row().is(row))
			if (!g.deactivate_row(row))
				return

		// remove from the dataset
		d.remove(ri)

		// remove from DOM
		g.render()

		// activate the row on the same cell as before
		g.activate_cell(g.cell(ri, ci))
	}

	g.toggle_expand_cell = function(cell) {

		if (!g.activate_cell(cell)) return
		var ri = g.rowof(cell).index()
		var ci = cell.index()

		if (!d.row(ri).childcount) return

		var expanded = !d.expanded(ri)
		d.setexpanded(ri, expanded)

		g.init()

		if (!g.activate()) return
		var cell = g.cell(ri, ci)
		g.activate_cell(cell)
		g.rowof(cell).toggleClass('expanded', expanded)
	}

	// saving / loading state -------------------------------------------------

	g.state = function() {
		//
	}

	g.update_state = function(state) {
		//
	}

	g.save_state = function() {
		//
	}

	// saving values ----------------------------------------------------------

	g.exit_row = function(row) {
		if (!g.exit_edit()) return
		return g.save_on_exit_row ? g.save_values() : true
	}

	g.save_values_success = function(data) {
		g.update_state(data)
		g.update_values(data.values)
	}

	g.save_values_error = function(xhr) {} // stub

	g.save_values = function() { return true; }

	g.update_values = function(values) {
		for (var i in values) {
			var rec = values[i]
			var row = g.row_byid(rec[id_fi])
			g.cells(row).each(function(ci, cell) {
				cell = $(cell)
				var fi = g.fieldmap[ci]
				var serverval = rec[fi]
				var oldval = cell.data('oldval')
				var userval = g.val(cell)
				if (serverval === userval) {
					cell.removeClass('rejected corrected changed')
					cell.removeData('oldval')
				} else if (serverval === oldval) {
					cell.removeClass('corrected')
					cell.addClass('rejected')
					cell.attr('title', rec.error)
				} else {
					cell.data('userval', userval)
					g.setval(cell, serverval)
					cell.removeData('oldval')
					cell.removeClass('rejected changed')
					cell.addClass('corrected')
					cell.attr('title', 'wanted: '+g.format_value(userval, g.field(ci)))
				}
			})
			// even if some cells got rejected and thus they're still marked
			// as "changed", the row itself will not be considered changed until
			// the user changes at least one cell again.
			row.removeClass('changed')
		}
	}

	// loading values ---------------------------------------------------------

	g.init = function() {

		// reset state
		if (g.active())
			active_grid = null
		active_row = $([])
		active_cell = $([])
		active_input = null
		g.render()

		g.activate_cell(g.cell(0, 0))
		if (g.immediate_mode)
			g.enter_edit(-1, true)

	}

	// cell navigation --------------------------------------------------------

	g.near_cell = function(cell, rows, cols) {
		cell = cell || g.active_cell()
		rows = rows || 0
		cols = cols || 0

		if (!cell.length) return cell // no cells

		var ri = g.rowof(cell).index() + rows
		var ci = cell.index() + cols

		// end of the row trying to move to the right: move to next-row-first-cell.
		// beginning of the row trying to move to the left: move to prev-row-last-cell.
		if (
			(cols < 0 && ci < 0) ||
			(cols > 0 && ci > g.colcount() - 1)
		) {
			ri = ri + sign(cols)
			if (ri < 0 || ri > g.rowcount() - 1)
				return
			ci = -sign(cols) * 1/0
		}

		var nearcell = g.cell(ri, ci)
		if (nearcell.is(cell)) return cell // didn't move, prevent recursion

		// skip readonly cells and rows
		if (d.field(nearcell.index()).readonly) {
			var ri = g.rowof(nearcell).index()
			var ci = cell.index()
			return g.near_cell(nearcell, sign(rows), sign(cols))
		}

		return nearcell
	}

	g.move = function(rows, cols) {
		return g.activate_cell(g.near_cell(null, rows, cols))
	}

	// column re-ordering -----------------------------------------------------

	g.move_col = function(sci, dci) {
		if (sci === dci) return

		d.move_field(sci, dci)

		// update DOM
		var scells = g.vcells(sci)
		var dcells = g.vcells(dci > sci && dci < g.colcount()-1 ? dci+1 : dci)
		if (dci == g.colcount()-1)
			dcells.each(function(i) {
				$(this).after(scells[i])
			})
		else
			dcells.each(function(i) {
				$(this).before(scells[i])
			})

		g.save_state()
	}

	// key bindings -----------------------------------------------------------

	$(document).keydown(function(e) {

		if (!g.active()) return

		var input = g.input()
		var caret = g.caret()

		// left and right arrows, tab and shift-tab: move left-right
		if (e.which == 37 || e.which == 39 || e.which == 9) {

			var cols =
				e.which == 9 ? (e.shiftKey ? -1 : 1) : (e.which == 37 ? -1 : 1)

			if (
				!input ||
				(e.altKey && e.shiftKey && !e.ctrlKey) ||
				g.quick_edit ||
				(g.immediate_mode &&
					g.focused() &&
					g.caret() == (cols < 0 ? 0 : input.val().length) &&
						(e.which == 9 || !e.shiftKey)
				)
			) {
				if (g.move(0, cols))
					if (input && g.immediate_mode)
						g.enter_edit(cols < 0 ? -1 : 0)
				e.preventDefault()
				return
			}

		}

		// up, down, page-up, page-down: move up-down
		if ((e.which == 38 || e.which == 33 || e.which == 40 || e.which == 34) &&
				(!input || g.immediate_mode || g.quick_edit)
		) {
			var rows
			switch(e.which) {
				case 38: rows = -1; break
				case 40: rows =  1; break
				case 33: rows = -g.page_rows; break
				case 34: rows =  g.page_rows; break
			}
			var selected = fully_selected(input)
			if (g.move(rows, 0) && input && g.immediate_mode)
				g.enter_edit(caret, selected)
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
			if (!input)
				g.enter_edit(null, true)
			else {
				g.exit_edit()
				g.move(1, 0)
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

	})

	// printable characters: enter quick edit mode
	$(document).keypress(function(e) {
		if (!g.active()) return
		if (e.charCode == 0) return
		if (e.ctrlKey  || e.metaKey || e.altKey) return
		if (g.input()) return
		g.enter_edit(null, true)
		g.quick_edit = true
	})

	// mouse bindings ---------------------------------------------------------

	function make_clickable() {

		// activate the grid by clicking on the header
		g.grid.on('click', '.field', function() {
			g.activate()
		})

		// activate cell / enter edit by clicking on a cell
		g.grid.on('click', '.cell', function() {
			if (g.active() && this == g.active_cell()[0])
				g.enter_edit(-1, true)
			else {
				if (g.activate())
					if (g.activate_cell(this))
						if (g.immediate_mode)
							g.enter_edit(-1, true)
			}
		})

		// trigger sorting by clicking on the field box
		g.grid.on('click', '.field_box a', function() {
			if (!g.activate()) return

			var ci = $(this).closest('.field').index()
			var field = d.field(ci)

			// toggle sorting on this field
			field.sort = field.sort == 'asc' ? 'desc' :
				(field.sort == 'desc' ? null : 'asc')

			d.load()
		})

		// resize columns by dragging the resizer
		g.grid.find('.resizer')

			.drag(function(e, drag) {

				g.activate() // resizing allowed even if activation failed

				var col = $(this).closest('.field')
				var ci = col.index()
				var field = d.field(ci)
				if (field.fixed_width) return // not movable

				// compute width
				var w = drag.offsetX - col.position().left

				// update data
				field.width = w

				// update DOM
				col.width(w)
			})

			.drag('end', function() {
				g.save_state()
			})

		// move columns --------------------------------------------------------

		function check_drop(e) {
			var col = g.drag.dropcol
			if (!col) return
			var o = col.offset()
			var x = o.left
			var y = o.top
			var w = col.width()
			var bw =
				parseInt(col.css('border-left-width'))+
				parseInt(col.css('margin-left'))+
				parseInt(col.css('padding-left'))
			var ci = col.index()
			if (e.clientX > x + w / 2) {
				if (ci == g.colcount() - 1) // last col
					x = x + w + bw
				else
					x = g.hcell(ci + 1).offset().left
				ci++
			}
			g.drag.drop_ci = ci
			g.drag.move_sign.css({ left: x + bw, top: y, }).show()
		}

		g.grid.find('.field')

			.drag('start', function(e) {
				if (!g.activate()) return
				var ci = $(this).index()
				var field = d.field(ci)
				if (field.fixed_pos) return
				var col = $(this)
				g.vcells(ci).css('opacity', 0.5)
				col.prepend(
					'<div class=dragging_div>'+
						'<div class="field dragging" style="'+
							'width: '+col.width()+'px;'+
							'height: '+col.height()+'px;'+
							'left: '+e.startX+'px;'+
							'">'+col.html()+
						'</div>'+
					'</div>')
				var div = g.grid.find('.dragging_div')
				var move_sign = g.grid.find('.move_sign_div')
				g.drag = {ci: ci, col: col, div: div, move_sign: move_sign}
				return div
			}, {
				relative: true,
				distance: 10,
			})

			.drag(function(e, d) {
				if (!g.drag) return
				g.drag.div.css({ left: d.offsetX, })
				check_drop(e)
			}, { relative: true, })

			.drag('end', function() {
				if (!g.drag) return
				g.drag.div.remove()
				g.vcells(g.drag.ci).css('opacity', '')
				g.drag.move_sign.hide()

				var sci = g.drag.ci       // source col
				var dci = g.drag.drop_ci  // dest. col
				if (dci != null) {
					// compensate for removal of the source col
					if (dci > sci)
						dci--
					g.move_col(sci, dci)
				}

				g.drag = null
			})

			.drop('start', function(e) {
				if (!g.drag) return
				var col = $(this)
				g.drag.dropcol = col
				check_drop(e)
				col.addClass('dropping')
			})

			.drop('end', function() {
				if (!g.drag) return
				$(this).removeClass('dropping')
			})

		// expand/collapse nodes

		g.grid.find('.expander').click(function(e) {
			e.preventDefault()
			if (!g.activate()) return

			var cell = $(this).closest('.cell')
			g.toggle_expand_cell(cell)
		})

	}

	// init -------------------------------------------------------------------

	update(g, g_opt)

	d = g.dataset
	d.on('reload', function() {
		g.render()
	})
	g.init()

	return g
}

return grid
})()
