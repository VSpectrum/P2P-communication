const loadFile = async (filename) => {
    try {
      const response = await fetch(`${filename}`);
      return await response.text();
    } catch (error) {
      console.error(error);
    }
  };

  const generateRandomString = (length) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz23456789';
    const randomBytes = new Uint8Array(length);
    window.crypto.getRandomValues(randomBytes);
    const randomChars = Array.from(randomBytes, byte => chars.charAt(byte % chars.length));
    return randomChars.join('');
}


const router = async () => {
    const app = document.getElementById('app');
    const room = window.location.hash;
    const validRoom = room.match(/^\#[A-Za-z0-9]{30}$/);
    if (validRoom) {
        const roomID = validRoom[0].substr(1);
        app.innerHTML = await loadFile('room.html');
        import(`./comms.js`);
    }
    else {
        // invalid room detected, generating new room
        window.location.hash = generateRandomString(30);
    }
}
window.addEventListener('popstate', router);
router();