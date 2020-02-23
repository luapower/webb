/*
	Dataset.
	Written by Cosmin Apreutesei. Public Domain.

READING

	id_field_name
	row_id(vri) -> id

	fieldcount()
	rowcount()

	field(vfi) -> field
	row(vri) -> row
	val(vri, vfi) -> val

UPDATING

	move_field(svfi, dvfi)

	setval(vri, vfi, val) -> val
	insert(vri) -> row
	remove(vri) -> row

	validate(val, field)
	convert(val, field) -> val

REMOTE UPDATING & RECONCILING

	load()
	save()
	reconcile()

*/

dataset = (function() {

// helpers -------------------------------------------------------------------

function make_url(path, opt_args, opt_params) {
	var args = []
	for (var i = 0; i < opt_args.length; i++)
		args.push(encodeURIComponent(opt_args[i]))
	args = args.join('/')

	var params = []
	var t = keys(opt_params, true)
	for (var i = 0; i < t.length; i++) {
		var k = t[i]
		params.push(encodeURIComponent(k)+'='+encodeURIComponent(opt_params[k]))
	}
	params = params.join('&')

	return path+(args?'/'+args:'')+(params?'?'+params:'')
}

function ValidationError() {
	var e = Error.apply(this, arguments)
	e.name = this.name = 'ValidationError'
	this.stack = e.stack
	this.message = e.message
	return this
}
var IntermediateInheritor = function() {}
IntermediateInheritor.prototype = Error.prototype
ValidationError.prototype = new IntermediateInheritor()

// dataset -------------------------------------------------------------------

var validators = {
	number: function(val, field) {
		if (parseFloat(val) === undefined)
			throw new ValidationError('invalid number')
	},
}

var converters = {
	number: function(val, field) {
		if (val == '' || val == null)
			return null
		return parseFloat(val)
	},
	boolean: function(val, field) {
		return !!val
	},
}

function dataset(d_opt) {

	var d = {
		converters: converters,
		validators: validators,
		ValidationError: ValidationError,
	}

	// events aspect ----------------------------------------------------------

	var ev = $(d)
	d.on = $.proxy(ev.on, ev)
	d.trigger = $.proxy(ev.trigger, ev)

	// memory I/O aspect ------------------------------------------------------

	// data
	var fields = [] // [fi: {name:, client_default: v, server_default: v, ...}]
	var rows   = [] // [ri: row]; row = {values: [fi: val], attr: val, ...}
	// row filter
	var filter      // function(values, ri) -> true|false

	var fieldindex_byname = function(fieldname) {
		for (var fi = 0; fi < fields.length; fi++)
			if (fields[fi].name == fieldname)
				return fi
	}

	var init_locals = function() {
		fields = d.fields
		rows = d.rows
		fieldmap = d.fieldmap
		filter = d.filter
	}

	var init_rowmap = function() {

		for (var ri = 0; ri < rows.length; ri++) {
			var row = rows[ri]
			var cn = row.childcount || 0

			// deleted? skip it and all the children
			if (row.deleted) {
				ri += cn
				continue
			}

			// filtered? skip it
			if (filter && !filter(row))
				continue

			rowmap.push(ri) // add it

			// collapsed? skip children
			if (cn && !filter && !row.expanded)
				ri += cn
		}
	}

	// get rows and fields

	d.fieldcount = function() { return fieldmap.length; }
	d.rowcount = function() { return rowmap.length; }

	d.field = function(vfi) { return fields[fieldmap[vfi]]; }
	d.row = function(vri) { return rows[rowmap[vri]]; }

	// move fields

	d.move_field = function(svfi, dvfi) {
		if (svfi === dvfi) return
		var sfi = d.fieldmap[svfi]
		d.fieldmap.remove(svfi)
		d.fieldmap.insert(dvfi, sfi)
	}

	// get/set row values

	d.val = function(vri, vfi) {
		var ri = rowmap[vri]
		var fi = fieldmap[vfi]
		var row = rows[ri]
		var field = fields[fi]
		var val = field.value // computed value?
		return val ? val(field, row, fields) : row.values[fi]
	}

	d.validate = function(val, field) {
		var validate = field.validate || d.validators[field.type]
		if (!validate) return
		validate.call(d, val, field)
	}

	d.convert = function(val, field) {
		var convert = field.convert || d.converters[field.type]
		return convert ? convert.call(d, val, field) : val
	}

	d.setval = function(vri, vfi, val) {
		var ri = rowmap[vri]
		var fi = fieldmap[vfi]
		var row = rows[ri]
		var field = fields[fi]

		// validate
		d.validate(val, field)

		// convert
		val = d.convert(val, field)

		// save old values if not already saved and the row is not new
		if (!row.isnew && !row.oldvalues)
			row.oldvalues = row.values.slice(0)

		// set the value
		row.values[fi] = val

		// trigger changed event
		ev.trigger('changed', [vri, vfi, val, field, row])

		// return converted value
		return val
	}

	// add/remove rows

	function new_row() {
		var rec = []

		// add server_default values or null
		for (var fi = 0; fi < fields.length; fi++) {
			var field = fields[fi]
			var val = field.server_default
			rec.push(val != null ? val : null)
		}

		return {values: rec, isnew: true}
	}

	d.insert = function(vri) {
		// default row index is right after the last row
		if (vri == null)
			vri = d.rowcount()

		var ri = rowmap[vri]
		// out of visible range? insert at the end of the unfiltered array
		if (ri === undefined)
			ri = rows.length

		// get parent row at index
		var parent_row = rows[ri] && rows[ri].parent_row

		// make a new row
		var row = new_row()

		// insert the new row at ri
		rows.insert(ri, row)

		// update idmap on ri
		update_idmap(ri)

		// add the row to the tree
		add_to_tree(row, parent_row)

		// recreate rowmap
		init_rowmap()

		// set client defaults
		for (var fi = 0; fi < fields.length; fi++) {
			var field = fields[fi]
			var val = field.client_default
			if (val != null)
				d.setval(ri, fi, val)
		}

		return row
	}

	d.remove = function(vri) {
		// default row index is that of the last row
		if (vri == null)
			vri = d.rowcount() - 1

		var ri = rowmap[vri]
		var row = rows[ri]

		// mark row as deleted
		row.deleted = true

		// mark children as deleted too
		delete_children(row)

		// recreate rowmap
		init_rowmap()

		return row
	}

	var remove_row = function() {
		for (var ri = 0; ri < rows.length; ri++) {

		}
	}

	d.init = function() {
		init_locals()
		init_idmap()
		init_tree()
		init_rowmap()
		ev.trigger('reload')
	}

	// row index by id aspect -------------------------------------------------

	var update_idmap = function(ri) {
		var id = rows[ri].values[id_fi]
		idmap[id] = ri
	}

	var idmap // {id: ri}
	var id_fi  // field index of the id field

	var init_idmap = function() {

		// find id_fi
		id_fi = d.id_field_name ?
			assert(fieldindex_byname(d.id_field_name)) :
			(d.id_field_index || 0)

		// init idmap based on id_fi
		idmap = {}
		for (var ri = 0; ri < rows.length; ri++)
			update_idmap(ri)

	}

	d.row_id = function(vri) {
		return rows[rowmap[vri]].values[id_fi]
	}

	// tree aspect ------------------------------------------------------------

	d.initially_expanded = false

	var parent_fi // field index of the parent field
	var root_rows

	var init_tree = function() {
		if (!d.parent_field) return

		// find the field index for the parent field (which is name or index)
		parent_fi = fieldindex_byname(d.parent_field) || d.parent_field

		// make tree
		root_rows = []
		d.root_rows = []
		var expanded = d.initially_expanded
		for (var ri = 0; ri < rows.length; ri++) {
			var row = rows[ri]
			row.expanded = expanded
			var pid = row.values[parent_fi]
			if (pid != null) {
				var prow = rows[idmap[pid]]
				row.parent_row = prow
				row.level = prow.level + 1
				if (!prow.children) {
					prow.children = []
					prow.childcount = 0
				}
				prow.children.push(row)
			} else {
				row.level = 0
				root_rows.push(row)
			}
		}

		// recreate the rows array based on the tree
		rows = []
		d.rows = rows
		function push_rows(root_rows) {
			for (var ri = 0; ri < root_rows.length; ri++) {
				var row = root_rows[ri]
				rows.push(row)
				if (row.children)
					push_rows(row.children)
			}
		}
		push_rows(root_rows)

		// compute and store direct+indirect child counts
		function count_children(row) {
			if (!row.children)
				return 0
			var rows = row.children
			var n = rows.length // direct child count
			for (var i = 0; i < rows.length; i++)
				n += count_children(rows[i])
			row.childcount = n  // store count
			return n
		}
		for (var i = 0; i < root_rows.length; i++)
			count_children(root_rows[i])
	}

	// add a newly added-to-the-dataset row to the tree
	var add_to_tree = function(row, parent_row) {
		if (!parent_row) {
			if (root_rows) {
				root_rows.push(row)
				row.level = 0
			}
			return
		}
		// set parent->child and child->parent links
		row.parent_row = parent_row
		row.level = parent_row.level + 1
		row.childcount = 0
		// add to parent (nevermind at which index)
		parent_row.children.push(row)
		// increment childcount in all parents
		while (parent_row) {
			parent_row.childcount++
			parent_row = parent_row.parent_row
		}
	}

	// recursively mark children of a row as deleted
	var delete_children = function(row) {
		var rows = row.children
		if (!rows) return
		for (var i = 0; i < rows.length; i++) {
			var row = rows[i]
			row.deleted = true
			delete_children(row)
		}
	}

	// remove a row from the tree, updating parents
	// NOTE: all children must be removed too, manually!
	var remove_from_tree = function(row) {
		var prow = row.parent_row
		if (!prow) return
		// remove from parent
		prow.children.remove(prow.children.indexOf(row))
		// update childcount in all parents
		do {
			prow.childcount--
			prow = prow.parent_row
		} while (prow)
	}

	d.parent_id = function(vri) {
		return rows[rowmap[vri]].values[parent_fi]
	}

	d.expanded = function(vri) {
		return d.row(vri).expanded
	}

	d.setexpanded = function(vri, expanded) {
		var row = d.row(vri)
		row.expanded = expanded
		init_rowmap()
	}

	d.collapse_all = function() {
		for (var ri = 0; ri < rows.length; ri++) {
			var row = rows[ri]
			if (row.expanded)
				row.expanded = false
		}
		init_rowmap()
	}

	d.expand_all = function() {
		for (var ri = 0; ri < rows.length; ri++) {
			var row = rows[ri]
			if (!row.expanded)
				row.expanded = true
		}
		init_rowmap()
	}

	// changeset aspect -------------------------------------------------------

	d.row_is_new = function(vri) { return rows[rowmap[vri]].isnew; }
	d.row_changed = function(vri) { return !!rows[rowmap[vri]].oldvalues; }

	d.oldval = function(vri, vfi) {
		var row = rows[rowmap[vri]]
		var fi = fieldmap[vfi]
		var oldvals = row.oldvalues
		return oldvals ? oldvals[fi] : row.values[fi]
	}

	d.val_changed = function(vri, vfi) {
		var row = rows[rowmap[vri]]
		var fi = fieldmap[vfi]
		var oldvals = row.oldvalues
		return oldvals && oldvals[fi] !== row.values[fi]
	}

	d.changes = function() {
		var insert = []
		var update = []
		var remove = []
		var ii = 0 // insert index
		for (var ri = 0; ri < rows.length; ri++) {
			var row = rows[ri]
			if (row.isnew && !row.deleted) {
				var rec = {}
				var values = row.values
				for (var fi = 0; fi < fields.length; fi++) {
					var val = values[fi]
					if (val != null)
						rec[fields[fi].name] = values[fi]
				}
				insert.push({values: rec})
				row.ii = ii // save it for reconciliation
				ii++
			} else if (row.oldvalues && !row.deleted) {
				var rec = {}
				var oldrec = {}
				var values = row.values
				var oldvalues = row.oldvalues
				for (var fi = 0; fi < fields.length; fi++) {
					var val = values[fi]
					var oldval = oldvalues[fi]
					var k = fields[fi].name
					oldrec[k] = oldval
					if (val !== oldval)
						rec[k] = val
				}
				update.push({values: rec, oldvalues: oldrec})
			} else if (row.deleted && !row.isnew) {
				var id = row.values[id_fi]
				remove.push(id)
			}
		}
		return {
			insert: insert,
			update: update,
			remove: remove,
		}
	}

	d.reconcile = function(results) {
		//
	}

	var remove_row = function(ri) {
		remove_from_tree(rows[ri])
		rows.remove(ri)
	}

	d.apply_changes = function() {
		for (var ri = 0; ri < rows.length; ri++) {
			var row = rows[ri]
			if (row.deleted) {
				remove_row(ri)
				ri--
				continue
			}
			if (row.oldvalues)
				row.oldvalues = null
			if (row.isnew)
				row.isnew = false
		}
		init_rowmap()
	}

	d.cancel_changes = function() {
		for (var ri = 0; ri < rows.length; ri++) {
			var row = rows[ri]
			if (row.isnew) {
				remove_row(ri)
				ri--
				continue
			}
			if (row.deleted)
				row.deleted = false
			if (row.oldvalues) {
				row.values = row.oldvalues
				row.oldvalues = null
			}
		}
		init_rowmap()
	}

	// remote I/O aspect ------------------------------------------------------

	// protocol options
	d.url_path = null   // set to enable remote I/O
	d.url_args = []     // path components after url_path
	d.url_params = {}   // url query params

	// pagination options
	d.page = 1
	d.page_size = 100

	// server-side order-by expression
	d.sort_expr = function() {
		var t = []
		for (var fi = 0; fi < fields.length; fi++) {
			var field = fields[fi]
			if (field.name && field.sort)
				t.push(field.name+':'+field.sort)
		}
		return t.join(',')
	}

	// url forming
	d.url = function() {
		if (!d.url_path) return
		var params = {}
		var sort = d.sort_expr()
		if (sort) params.sort = sort
		if (d.page) params.page = d.page
		update(params, d.url_params)
		return make_url(d.url_path, d.url_args, params)
	}

	// make a GET request (or a POST request if data is passed).
	d.ajax = function(data, success, error) {
		print('hello')
		var url = d.url()
		if (!url) return
		var opt = {success: success, error: error}
		if (data != null) {
			opt.type = 'POST'
			opt.data = {data: json(data)}
		}
		$.ajax(url, opt)
	}

	d.load = function(success, error) {
		function succ(data) {
			d.fields = data.fields
			d.rows = data.rows
			d.fieldmap = data.fieldmap
			d.init()
			if (success) success(data)
		}
		d.ajax(null, succ, error)
	}

	d.save = function(success, error) {
		function succ(data) {
			d.reconcile(data)
			if (success) success()
		}
		d.ajax(d.changes(), succ, error)
	}

	// init -------------------------------------------------------------------
	update(d, d_opt)

	d.init()
	d.json = json
	d.make_url = make_url
	return d
}

return dataset
})()
