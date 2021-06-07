import {normalizeIdentifier} from 'micromark-util-normalize-identifier'

const own = {}.hasOwnProperty

export const footnoteHtml = {
  enter: {
    footnoteDefinition() {
      this.getData('tightStack').push(false)
    },
    footnoteDefinitionLabelString() {
      this.buffer()
    },
    footnoteCallString() {
      this.buffer()
    },
    inlineNoteText() {
      const counter = (this.getData('inlineNoteCounter') || 0) + 1
      let stack = this.getData('inlineNoteStack')
      let calls = this.getData('footnoteCallOrder')

      if (!stack) this.setData('inlineNoteStack', (stack = []))
      if (!calls) this.setData('footnoteCallOrder', (calls = []))

      stack.push(counter)
      calls.push(counter)
      this.setData('inlineNoteCounter', counter)
      this.buffer()
    }
  },
  exit: {
    footnoteDefinition() {
      let definitions = this.getData('footnoteDefinitions')
      const stack = this.getData('footnoteDefinitionStack')
      const current = stack.pop()
      const value = this.resume()

      if (!definitions) this.setData('footnoteDefinitions', (definitions = {}))
      if (!own.call(definitions, current)) definitions[current] = value

      this.getData('tightStack').pop()
      this.setData('slurpOneLineEnding', true)
      // “Hack” to prevent a line ending from showing up if we’re in a definition in
      // an empty list item.
      this.setData('lastWasTag')
    },
    footnoteDefinitionLabelString(token) {
      let stack = this.getData('footnoteDefinitionStack')

      if (!stack) this.setData('footnoteDefinitionStack', (stack = []))

      stack.push(normalizeIdentifier(this.sliceSerialize(token)))
      this.resume() // Drop the label.
      this.buffer() // Get ready for a value.
    },
    footnoteCallString(token) {
      let calls = this.getData('footnoteCallOrder')
      const id = normalizeIdentifier(this.sliceSerialize(token))
      let counter

      this.resume()

      if (!calls) this.setData('footnoteCallOrder', (calls = []))

      const index = calls.indexOf(id)

      if (index === -1) {
        calls.push(id)
        counter = calls.length
      } else {
        counter = index + 1
      }

      createCall.call(this, String(counter))
    },
    inlineNoteText() {
      const counter = this.getData('inlineNoteStack').pop()
      let notes = this.getData('inlineNotes')

      if (!notes) this.setData('inlineNotes', (notes = {}))

      notes[counter] = '<p>' + this.resume() + '</p>'
      createCall.call(this, String(counter))
    },
    null() {
      const calls = this.getData('footnoteCallOrder') || []
      const definitions = this.getData('footnoteDefinitions') || {}
      const notes = this.getData('inlineNotes') || {}
      let index = -1
      let value
      let id
      let injected
      let back
      let counter

      if (calls.length > 0) {
        this.lineEndingIfNeeded()
        this.tag('<div class="footnotes">')
        this.lineEndingIfNeeded()
        this.tag('<hr />')
        this.lineEndingIfNeeded()
        this.tag('<ol>')
      }

      while (++index < calls.length) {
        // Called definitions are always defined.
        id = calls[index]
        counter = String(index + 1)
        injected = false
        back = '<a href="#fnref' + counter + '" class="footnote-back">↩︎</a>'
        value = (typeof id === 'number' ? notes : definitions)[id].replace(
          /<\/p>(?:\r?\n|\r)?$/,
          injectBack
        )

        this.lineEndingIfNeeded()
        this.tag('<li id="fn' + counter + '">')
        this.lineEndingIfNeeded()
        this.raw(value)

        if (!injected) {
          this.lineEndingIfNeeded()
          this.tag(back)
        }

        this.lineEndingIfNeeded()
        this.tag('</li>')
      }

      if (calls.length > 0) {
        this.lineEndingIfNeeded()
        this.tag('</ol>')
        this.lineEndingIfNeeded()
        this.tag('</div>')
      }

      function injectBack($0) {
        injected = true
        return back + $0
      }
    }
  }
}

function createCall(counter) {
  this.tag(
    '<a href="#fn' +
      counter +
      '" class="footnote-ref" id="fnref' +
      counter +
      '"><sup>'
  )
  this.raw(counter)
  this.tag('</sup></a>')
}
