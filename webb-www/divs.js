/*

	e.caret_pos -> i
	e.caret_pos = i

*/




// text-editables ------------------------------------------------------------

property(Element, 'caret_pos', {
	get: function() {
		if (target.contentEditable === 'true') {
			target.focus()
			var range1 = window.getSelection().getRangeAt(0)
			var range2 = range1.cloneRange()
			range2.selectNodeContents(target)
			range2.setEnd(range1.endContainer, range1.endOffset)
			return range2.toString().length
		} else {
			return target.selectionStart
		}
	},
	set: function(pos) {
		if (pos == -1) {
			pos = this[isContentEditable? 'text' : 'val']().length
		}
		if (isContentEditable) {
			target.focus()
			window.getSelection().collapse(target.firstChild, pos)
		} else { //textarea
			target.setSelectionRange(pos, pos)
		}
		if (!isContentEditable) {
			target.focus()
		}
		return pos
	}
})

