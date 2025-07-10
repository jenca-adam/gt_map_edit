$("#error-box-container").hide();
function hideError(){
    $("#error-box-container").hide()
}
function showError(message, onOk){
    $("#error-box-button").unbind("click").click(function(){hideError();onOk()});
    $("#error-box-content").html(message);
    $("#error-box-container").show();
}
