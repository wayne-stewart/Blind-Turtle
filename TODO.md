
# HIGH PRIORITY
- [ ] Add Github integration
- [ ] Make about page first to show when accessing from a device/browser that does not have local data..
- [ ] Add Some instructions to About page
- [x] Add library attribution to About page
- [ ] Change doc view from textarea to a contenteditable container
- [ ] Add Search
- [ ] Add Next/Previous Search result navigation
- [ ] Optimize for mobile and desktop
- [ ] Add tabbed interface to open multiple documents at once
- [ ] minify/uglify js in a build process
- [ ] add tests
- [ ] add password generator
- [ ] add structured document capability like a key/value store.

# INCREASE SECURITY
- [ ] Add second encryption layer to saved document ( twofish, threefish )
- [ ] Obfuscate SJCL output so the precise algorithm info is hidden
- [ ] Keep everything encrypted in memory
- [ ] Encrypt keys and values separately in a key/value store.
- [ ] Do not decrypt secrets until needed
- [ ] Control memory so decrypted secrets are zeroed out
- [ ] Encrypt the master password in memory
- [ ] Don't use standard controls for displaying secrets, I don't have control over their memory.

# LOW PRIORITY
- [ ] Add Dropbox integration
- [ ] Add Google Drive integration
- [ ] Add iCloud integration
- [ ] Harden node server
- [ ] Add ability to store documents with node server.
- [ ] Create browser plugin out of it to automate filling in sensitive fields