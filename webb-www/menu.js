/*
	Menu Widget.
	Written by Cosmin Apreutesei. Public Domain.

*/

function menu(...options) {

	let m = {
		//
	}

	function init() {
		update(m, ...options)
		reload()
		hook_unhook_events(true)
	}

	function hook_unhook_events(on) {
		document.onoff('mousedown', mousedown)
	}

	function item_click(e) {
		let a = this.action
		print(a)
	}

	function item_mouseenter(e) {
		show_submenu(this)
	}

	function item_mouseleave(e) {
		hide_submenu(this)
	}

	function create_item(a) {
		let check_td = H.td({class: 'menu-check-td'})
		let title_td = H.td({class: 'menu-title-td'}, a.title)
		let key_td   = H.td({class: 'menu-key-td'})
		let sub_div  = H.div({class: 'menu-sub-div fa fa-caret-right'})
		let sub_td   = H.td({class: 'menu-sub-td'}, sub_div)
		sub_div.style.visibility = a.actions ? null : 'hidden'
		let tr = H.tr({class: 'menu-tr'}, check_td, title_td, key_td, sub_td)
		tr.action = a
		tr.on('click', item_click)
		if (a.actions) {
			tr.on('mouseenter', item_mouseenter)
			tr.on('mouseleave', item_mouseleave)
		}
		return tr
	}

	function create_menu(actions) {
		let table = H.table({class: 'menu-table'})
		for (let i = 0; i < actions.length; i++)
			table.add(create_item(actions[i]))
		return table
	}

	function show_submenu(parent_tr) {
		let table = create_menu(parent_tr.action.actions)
		table.x = parent_tr.parent.offsetLeft + parent_tr.clientWidth - 5
		table.y = parent_tr.parent.offsetTop + parent_tr.offsetTop
		document.body.add(table)
	}

	function create_view() {
		m.table = create_menu(m.actions)
	}

	function reload() {
		create_view()
	}

	m.popup = function(x, y) {
		let parent = document.body
		if (parent.contains(m.table))
			return
		m.popup_parent = parent
		m.table.x = x || 0
		m.table.y = y || 0
		parent.add(m.table)
		document.on('mousedown', mousedown)
	}

	function mousedown(e) {
		if (!m.popup_parent)
			return
		m.popup_parent.remove(m.table)
		m.popup_parent = null
	}

	init()

	return m

}
