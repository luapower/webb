/*
	Menu Widget.
	Written by Cosmin Apreutesei. Public Domain.

*/

function menu(...options) {

	let m = {}

	function init() {
		update(m, ...options)
	}

	function create_item(a) {
		let check_div = H.div({class: 'menu-check-div fa fa-check'})
		let icon_div  = H.div({class: 'menu-icon-div '+(a.icon_class || '')})
		let check_td  = H.td ({class: 'menu-check-td'}, check_div, icon_div)
		let title_td  = H.td ({class: 'menu-title-td'}, a.title)
		let key_td    = H.td ({class: 'menu-key-td'}, a.key)
		let sub_div   = H.div({class: 'menu-sub-div fa fa-caret-right'})
		let sub_td    = H.td ({class: 'menu-sub-td'}, sub_div)
		sub_div.style.visibility = a.actions ? null : 'hidden'
		let tr = H.tr({class: 'menu-tr'}, check_td, title_td, key_td, sub_td)
		tr.class('enabled', a.enabled != false)
		tr.action = a
		tr.check_div = check_div
		update_check(tr)
		tr.on('mousedown', item_mousedown)
		tr.on('mouseenter', item_mouseenter)
		tr.on('mouseleave', item_mouseleave)
		return tr
	}

	function create_separator() {
		let td = H.td({colspan: 5}, H.hr())
		let tr = H.tr({class: 'menu-separator-tr'}, td)
		return tr
	}

	function create_menu(actions) {
		let table = H.table({class: 'menu-table'})
		for (let i = 0; i < actions.length; i++) {
			let a = actions[i]
			table.add(create_item(a))
			if (a.separator)
				table.add(create_separator())
		}
		table.on('mouseenter', menu_mouseenter)
		table.on('mouseleave', menu_mouseleave)
		return table
	}

	function show_menu(x, y, offset_parent) {
		offset_parent = offset_parent || document.body
		let table = create_menu(m.actions)
		table.x = offset_parent.offsetLeft + x
		table.y = offset_parent.offsetTop + y
		document.body.add(table)
		table.document_mousedown = function() {
			m.close()
		}
		document.on('mousedown', table.document_mousedown)
		return table
	}

	function hide_menu(table) {
		table.remove()
		document.off('mousedown', table.document_mousedown)
	}

	function show_submenu(item_tr) {
		let actions = item_tr.action.actions
		if (!actions)
			return
		let table = create_menu(actions)
		table.x = item_tr.clientWidth - 2
		item_tr.submenu_table = table
		item_tr.add(table)
		return table
	}

	function hide_submenu(item_tr) {
		if (!item_tr)
			return
		if (!item_tr.submenu_table)
			return
		if (item_tr.submenu_table.keep_open)
			return
		item_tr.submenu_table.remove()
		item_tr.submenu_table = null
	}

	function update_check(tr) {
		tr.check_div.style.display = tr.action.checked ? null : 'none'
	}

	function item_mousedown(e) {
		let a = this.action
		if ((a.click || a.checked != null) && this.hasclass('enabled')) {
			if (a.checked != null) {
				a.checked = !a.checked
				update_check(this)
			}
			if (!a.click || a.click(a) != false)
				m.close()
		}
		e.preventDefault()
		e.stopPropagation()
	}

	function menu_mouseenter() {
		this.keep_open = true
	}

	function menu_mouseleave() {
		this.keep_open = false
	}

	function item_mouseenter() {
		let tr = this
		hide_submenu(tr.parent.selected_item_tr)
		show_submenu(tr)
		tr.parent.selected_item_tr = tr
	}

	function item_mouseleave() {
		let tr = this
		hide_submenu(tr)
		tr.parent.selected_item_tr = null
	}

	m.popup = function(x, y, offset_parent) {
		if (m.table)
			return
		m.table = show_menu(x, y, offset_parent)
	}

	m.close = function() {
		if (!m.table)
			return
		hide_menu(m.table)
		m.table = null
	}

	init()

	return m

}
