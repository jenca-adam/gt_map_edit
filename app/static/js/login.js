const showFormError = (message) => {
    $("#form-error").hide().text(message).show(100);
};
const logInMailPassword = async (mail, password) => {
    const response = await logIn(mail, password, visitorId);
    if (response.status != "ok") {
        console.error(response.message);
        showFormError(response.message);
        return null;
    };
    return response.response.token;
};
const logInToken = async (token) => {
    const response = await getUserInfoViaToken(token);
    if (response.status != "ok") {
        console.error(response.message);
        showFormError(response.message);
        return null;
    }
    window.localStorage.setItem("userData", JSON.stringify(response.response));
    return response.response.token;
};
$(document).ready(() => {
    if ($("#lms-token").prop("checked")) {
        $("#form-mail-password").hide();
    } else {
        $("#lms-mail-password").prop("checked", true);
        $("#form-token").hide();
    }
});
$("#lms-token").change(() => {
    $("#form-token").show();
    $("#form-mail-password").hide()
});
$("#lms-mail-password").change(() => {
    $("#form-token").hide();
    $("#form-mail-password").show()
});
$("#form-mail-password").submit((ev) => {
    try {
        logInMailPassword($("#mail").val(), $("#password").val()).then((tok) => {
            localStorage.setItem("token", tok);
            getUserInfoViaToken(tok).then((response) => {
                if (response.status == "ok") {
                    localStorage.setItem("userData", JSON.stringify(response.response))
                    location.href = '/';
                } else {
                    console.error(response.message);
                }
            });
        });
    } finally {
        ev.preventDefault();
        return false;
    }
});
$("#form-token").submit((ev) => {
    try {
        logInToken($("#token").val()).then((tok) => {
            if (tok) {
                localStorage.setItem("token", tok);
                location.href = '/';
            }
        });
    } finally {
        ev.preventDefault();
        return false;
    }
});