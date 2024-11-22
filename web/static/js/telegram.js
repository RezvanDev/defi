const miniapp_data = Telegram.WebApp.initDataUnsafe;
const index = document.getElementById("header-index");


Telegram.WebApp.BackButton.show();
Telegram.WebApp.BackButton.onClick(() => {

    window.history.back();
});

async function get_tg_data() {
    // if (!miniapp_data.user) {
    //     // window.location.replace("about:blank");
    // }

    const response = await fetch('/auth/login', {
       method: "POST",
       headers: {
          "Content-Type": "application/json"
       },
       body: JSON.stringify({
          username: miniapp_data.user.username,
          userid: miniapp_data.user.id
       })
    });

    if (response.ok) {
       const { token } = await response.json();
       localStorage.setItem('authToken', token);
    } else {
       console.error("Error Auth");
       // window.location.replace("about:blank");
    }

    if (miniapp_data.user) {
       index.innerText = `${miniapp_data.user.username}`;
    }
}

get_tg_data();