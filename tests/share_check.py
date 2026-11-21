"""Run with Python Playwright and Google Chrome installed."""

from pathlib import Path

from playwright.sync_api import expect, sync_playwright


URL = (Path(__file__).resolve().parent.parent / 'index.html').as_uri()


def finish_round(page):
    return page.evaluate('''() => {
      const game = window.__skyline;
      game.startPlay();
      for (let i = 0; i < 3599; i++) game.update(1 / 60);
      if (game.state.mode !== 'play') throw new Error('Round ended early');
      for (let i = 0; i < 3; i++) game.update(1 / 60);
      if (game.state.mode !== 'over') throw new Error('Round did not end');
      return Math.floor(game.state.score);
    }''')


def check_viewport(browser, width, height):
    page = browser.new_page(viewport={'width': width, 'height': height})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    page.goto(URL)
    page.evaluate('''() => {
      localStorage.clear();
      window.__skyline.opts.sound = false;
    }''')

    score = finish_round(page)
    line = f'Beat me at Skyline Relay — {score} pts'
    assert page.locator('#share-line').inner_text() == line
    assert page.locator('#final').inner_text().startswith(f'{score} pts')
    assert page.locator('#copy-share').bounding_box()['height'] >= 64

    # Exercise the actual browser clipboard while the game is opened from disk.
    page.locator('#copy-share').click()
    expect(page.locator('#share-status')).to_have_text('Copied!')
    page.evaluate('''() => {
      const input = document.createElement('textarea');
      input.id = 'paste-check'; document.body.appendChild(input); input.focus();
    }''')
    page.keyboard.press('Control+V')
    assert page.locator('#paste-check').input_value() == line
    page.locator('#paste-check').evaluate('(input) => input.remove()')

    # Check the clipboard API path and that Space activates the results button.
    page.evaluate('''() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async text => { window.copiedText = text; }
      }});
    }''')
    page.locator('#copy-share').focus()
    page.keyboard.press('Space')
    assert page.locator('#share-status').inner_text() == 'Copied!'
    assert page.evaluate('window.copiedText') == line
    page.locator('#save').click()
    assert page.locator('#share-line').inner_text() == line
    page.locator('#again').click()

    # A full board and a second run exercise scrolling, non-qualification and reset.
    page.evaluate('''() => {
      const key = 'sr-board-' + new Date().toISOString().slice(0, 10);
      localStorage.setItem(key, JSON.stringify(Array.from({length: 10}, (_, i) =>
        ({id: i, name: 'AAA', rings: 0, score: 100000 - i}))));
    }''')
    score = finish_round(page)
    line = f'Beat me at Skyline Relay — {score} pts'
    assert page.locator('#share-line').inner_text() == line
    assert page.locator('#share-status').inner_text() == ''
    assert not page.locator('#initials-wrap').is_visible()

    # A rejected clipboard API falls back to the browser's real copy command.
    page.evaluate('''() => {
      navigator.clipboard.writeText = async () => { throw new Error('denied'); };
      document.addEventListener('copy', () => { window.fallbackText = getSelection().toString(); });
    }''')
    page.locator('#copy-share').click()
    assert page.locator('#share-status').inner_text() == 'Copied!'
    assert page.evaluate('window.fallbackText') == line

    # If both methods fail, the text remains selected and an explanation is shown.
    page.evaluate("document.execCommand = () => false")
    page.locator('#copy-share').click()
    assert 'Unable to copy' in page.locator('#share-status').inner_text()
    assert page.evaluate('getSelection().toString()') == line
    page.locator('#again').click()

    # A full board with a qualifying score must still allow access to both ends.
    page.evaluate('''() => {
      const key = 'sr-board-' + new Date().toISOString().slice(0, 10);
      const rows = JSON.parse(localStorage.getItem(key));
      rows[9].score = 0;
      localStorage.setItem(key, JSON.stringify(rows));
    }''')
    finish_round(page)
    assert page.locator('#initials-wrap').is_visible()
    page.locator('#copy-share').click()
    page.locator('#again').click()
    page.wait_for_timeout(100)
    assert not errors, errors
    print(f'{width}x{height}: full rounds, share and fallback checks passed; no console errors')
    page.close()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    for dimensions in [(1280, 720), (390, 844)]:
        check_viewport(browser, *dimensions)
    browser.close()