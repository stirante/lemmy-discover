# lemmy-discover

[Check it out here](https://stirante.github.io/lemmy-discover/)

A simple web app to discover new communities on Lemmy.

## TODO

- [ ] Add UI for filtering NSFW communities (currently all NSFW communities are hidden. This setting is saved in local storage as `nsfwFilter` and valid values are `all`, `none` and `only`)
- [ ] Add UI for filtering instances (currently you can manually exclude an instance by adding it to the `blockedInstances` array in local storage)
- [ ] Improve responsiveness
- [ ] Automatically update the list of communities
- [ ] Find out why following sometimes doesn't work

## Local development

```bash
git clone https://github.com/stirante/lemmy-discover.git
cd lemmy-discover
npm install
npm run dev
```

## Privacy

You can use it without logging in, but if you do, it will store your Lemmy instance URL and your access token in your browser's local storage. This is so that you don't have to log in every time you visit the app.

The login data is not sent anywhere else, and is only used to make requests to the Lemmy API in order to follow communities.