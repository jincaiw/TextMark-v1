describe('TextMark updater runtime probe', () => {
  it('checks the stable manifest through the real Rust command', async () => {
    await browser.tauri.switchWindow('main')
    await $('.markdown-body h1').waitForDisplayed()
    const result = await browser.tauri.execute((tauri) => tauri.core.invoke('check_update_channel', { channel: 'stable' }))
    console.log(`UPDATER_RESULT=${JSON.stringify(result)}`)
    expect(result).toBeNull()
  })
})
