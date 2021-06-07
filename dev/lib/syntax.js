import assert from 'assert'
import {blankLine} from 'micromark-core-commonmark'
import {factorySpace} from 'micromark-factory-space'
import {
  markdownLineEnding,
  markdownLineEndingOrSpace,
  markdownSpace
} from 'micromark-util-character'
import {splice} from 'micromark-util-chunked'
import {codes} from 'micromark-util-symbol/codes.js'
import {constants} from 'micromark-util-symbol/constants.js'
import {normalizeIdentifier} from 'micromark-util-normalize-identifier'
import {resolveAll} from 'micromark-util-resolve-all'

const indent = {tokenize: tokenizeIndent, partial: true}

export function footnote(options) {
  const settings = options || {}
  const call = {tokenize: tokenizeFootnoteCall}
  const noteStart = {tokenize: tokenizeNoteStart, resolveAll: resolveAllNote}
  const noteEnd = {
    add: 'after',
    tokenize: tokenizeNoteEnd,
    resolveAll: resolveAllNote,
    resolveTo: resolveToNoteEnd
  }
  const definition = {
    tokenize: tokenizeDefinitionStart,
    continuation: {tokenize: tokenizeDefinitionContinuation},
    exit: footnoteDefinitionEnd
  }
  const text = {[codes.leftSquareBracket]: call}

  if (settings.inlineNotes) {
    text[codes.rightSquareBracket] = noteEnd
    text[codes.caret] = noteStart
  }

  return {
    _hiddenFootnoteSupport: {},
    document: {[codes.leftSquareBracket]: definition},
    text
  }
}

// Remove remaining note starts.
function resolveAllNote(events) {
  let index = -1
  let token

  while (++index < events.length) {
    token = events[index][1]

    if (events[index][0] === 'enter' && token.type === 'inlineNoteStart') {
      token.type = 'data'
      // Remove the two marker (`^[`).
      events.splice(index + 1, 4)
    }
  }

  return events
}

function resolveToNoteEnd(events, context) {
  let index = events.length - 4
  let token
  let type
  let openIndex

  // Find an opening.
  while (index--) {
    token = events[index][1]

    // Find where the note starts.
    if (events[index][0] === 'enter' && token.type === 'inlineNoteStart') {
      openIndex = index
      type = 'inlineNote'
      break
    }
  }

  const group = {
    type,
    start: Object.assign({}, events[openIndex][1].start),
    end: Object.assign({}, events[events.length - 1][1].end)
  }

  const text = {
    type: 'inlineNoteText',
    start: Object.assign({}, events[openIndex + 4][1].end),
    end: Object.assign({}, events[events.length - 3][1].start)
  }

  const note = [
    ['enter', group, context],
    events[openIndex + 1],
    events[openIndex + 2],
    events[openIndex + 3],
    events[openIndex + 4],
    ['enter', text, context]
  ]

  splice(
    note,
    note.length,
    0,
    resolveAll(
      context.parser.constructs.insideSpan.null,
      events.slice(openIndex + 6, -4),
      context
    )
  )

  note.push(
    ['exit', text, context],
    events[events.length - 2],
    events[events.length - 3],
    ['exit', group, context]
  )

  splice(events, index, events.length - index, note)

  return events
}

function tokenizeFootnoteCall(effects, ok, nok) {
  const self = this
  const defined = self.parser.footnotes || (self.parser.footnotes = [])
  let size = 0
  let data

  return start

  function start(code) {
    assert(code === codes.leftSquareBracket, 'expected `[`')
    effects.enter('footnoteCall')
    effects.enter('footnoteCallLabelMarker')
    effects.consume(code)
    effects.exit('footnoteCallLabelMarker')
    return callStart
  }

  function callStart(code) {
    if (code !== codes.caret) return nok(code)

    effects.enter('footnoteCallMarker')
    effects.consume(code)
    effects.exit('footnoteCallMarker')
    effects.enter('footnoteCallString')
    effects.enter('chunkString').contentType = 'string'
    return callData
  }

  function callData(code) {
    let token

    if (
      code === codes.eof ||
      code === codes.leftSquareBracket ||
      size++ > constants.linkReferenceSizeMax
    ) {
      return nok(code)
    }

    if (code === codes.rightSquareBracket) {
      if (!data) {
        return nok(code)
      }

      effects.exit('chunkString')
      token = effects.exit('footnoteCallString')
      return defined.includes(normalizeIdentifier(self.sliceSerialize(token)))
        ? end(code)
        : nok(code)
    }

    effects.consume(code)

    if (!markdownLineEndingOrSpace(code)) {
      data = true
    }

    return code === codes.backslash ? callEscape : callData
  }

  function callEscape(code) {
    if (
      code === codes.leftSquareBracket ||
      code === codes.backslash ||
      code === codes.rightSquareBracket
    ) {
      effects.consume(code)
      size++
      return callData
    }

    return callData(code)
  }

  function end(code) {
    // Always a `]`.
    effects.enter('footnoteCallLabelMarker')
    effects.consume(code)
    effects.exit('footnoteCallLabelMarker')
    effects.exit('footnoteCall')
    return ok
  }
}

function tokenizeNoteStart(effects, ok, nok) {
  return start

  function start(code) {
    assert(code === codes.caret, 'expected `^`')
    effects.enter('inlineNoteStart')
    effects.enter('inlineNoteMarker')
    effects.consume(code)
    effects.exit('inlineNoteMarker')
    return noteStart
  }

  function noteStart(code) {
    if (code !== codes.leftSquareBracket) return nok(code)

    effects.enter('inlineNoteStartMarker')
    effects.consume(code)
    effects.exit('inlineNoteStartMarker')
    effects.exit('inlineNoteStart')
    return ok
  }
}

function tokenizeNoteEnd(effects, ok, nok) {
  const self = this

  return start

  function start(code) {
    assert(code === codes.rightSquareBracket, 'expected `]`')
    let index = self.events.length
    let hasStart

    // Find an opening.
    while (index--) {
      if (self.events[index][1].type === 'inlineNoteStart') {
        hasStart = true
        break
      }
    }

    if (!hasStart) {
      return nok(code)
    }

    effects.enter('inlineNoteEnd')
    effects.enter('inlineNoteEndMarker')
    effects.consume(code)
    effects.exit('inlineNoteEndMarker')
    effects.exit('inlineNoteEnd')
    return ok
  }
}

function tokenizeDefinitionStart(effects, ok, nok) {
  const self = this
  const defined = self.parser.footnotes || (self.parser.footnotes = [])
  let identifier
  let size = 0
  let data

  return start

  function start(code) {
    assert(code === codes.leftSquareBracket, 'expected `[`')
    effects.enter('footnoteDefinition')._container = true
    effects.enter('footnoteDefinitionLabel')
    effects.enter('footnoteDefinitionLabelMarker')
    effects.consume(code)
    effects.exit('footnoteDefinitionLabelMarker')
    return labelStart
  }

  function labelStart(code) {
    // `^`
    if (code !== codes.caret) return nok(code)

    effects.enter('footnoteDefinitionMarker')
    effects.consume(code)
    effects.exit('footnoteDefinitionMarker')
    effects.enter('footnoteDefinitionLabelString')
    return atBreak
  }

  function atBreak(code) {
    let token

    if (
      code === codes.eof ||
      code === codes.leftSquareBracket ||
      size > constants.linkReferenceSizeMax
    ) {
      return nok(code)
    }

    if (code === codes.rightSquareBracket) {
      if (!data) {
        return nok(code)
      }

      token = effects.exit('footnoteDefinitionLabelString')
      identifier = normalizeIdentifier(self.sliceSerialize(token))
      effects.enter('footnoteDefinitionLabelMarker')
      effects.consume(code)
      effects.exit('footnoteDefinitionLabelMarker')
      effects.exit('footnoteDefinitionLabel')
      return labelAfter
    }

    if (markdownLineEnding(code)) {
      effects.enter('lineEnding')
      effects.consume(code)
      effects.exit('lineEnding')
      size++
      return atBreak
    }

    effects.enter('chunkString').contentType = 'string'
    return label(code)
  }

  function label(code) {
    if (
      code === codes.eof ||
      markdownLineEnding(code) ||
      code === codes.leftSquareBracket ||
      code === codes.rightSquareBracket ||
      size > constants.linkReferenceSizeMax
    ) {
      effects.exit('chunkString')
      return atBreak(code)
    }

    if (!markdownLineEndingOrSpace(code)) {
      data = true
    }

    size++
    effects.consume(code)
    return code === codes.backslash ? labelEscape : label
  }

  function labelEscape(code) {
    if (
      code === codes.leftSquareBracket ||
      code === codes.backslash ||
      code === codes.rightSquareBracket
    ) {
      effects.consume(code)
      size++
      return label
    }

    return label(code)
  }

  function labelAfter(code) {
    if (code !== codes.colon) {
      return nok(code)
    }

    effects.enter('definitionMarker')
    effects.consume(code)
    effects.exit('definitionMarker')
    return effects.check(blankLine, onBlank, nonBlank)
  }

  function onBlank(code) {
    self.containerState.initialBlankLine = true
    return done(code)
  }

  function nonBlank(code) {
    if (markdownSpace(code)) {
      effects.enter('footnoteDefinitionWhitespace')
      effects.consume(code)
      effects.exit('footnoteDefinitionWhitespace')
      return done(code)
    }

    // No space is also fine, just like a block quote marker.
    return done(code)
  }

  function done(code) {
    if (!defined.includes(identifier)) {
      defined.push(identifier)
    }

    return ok(code)
  }
}

function tokenizeDefinitionContinuation(effects, ok, nok) {
  const self = this

  return effects.check(blankLine, onBlank, notBlank)

  // Continued blank lines are fine.
  function onBlank(code) {
    if (self.containerState.initialBlankLine) {
      self.containerState.furtherBlankLines = true
    }

    return ok(code)
  }

  // If there were continued blank lines, or this isn’t indented at all.
  function notBlank(code) {
    if (self.containerState.furtherBlankLines || !markdownSpace(code)) {
      return nok(code)
    }

    self.containerState.initialBlankLine = undefined
    self.containerState.furtherBlankLines = undefined
    return effects.attempt(indent, ok, nok)(code)
  }
}

function footnoteDefinitionEnd(effects) {
  effects.exit('footnoteDefinition')
}

function tokenizeIndent(effects, ok, nok) {
  const self = this

  return factorySpace(
    effects,
    afterPrefix,
    'footnoteDefinitionIndent',
    constants.tabSize + 1
  )

  function afterPrefix(code) {
    const tail = self.events[self.events.length - 1]
    return tail &&
      tail[1].type === 'footnoteDefinitionIndent' &&
      tail[2].sliceSerialize(tail[1], true).length === constants.tabSize
      ? ok(code)
      : nok(code)
  }
}
