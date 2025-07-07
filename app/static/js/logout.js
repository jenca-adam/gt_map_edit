const logOut = ()=>{
    localStorage.removeItem("token");
    localStorage.removeItem("userData");
    location.href = "/login";
};

if(!window.localStorage.token){
    $("#logout").hide();
}
$("#logout").click(logOut);
