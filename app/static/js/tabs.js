$.fn.tabs=function(){

    this.find(".tab").filter(function(){return !$(this).hasClass("active")}).hide();
    var activeTab = this.find(".tab.active").data("tab");
    this.find(".tab-button").filter(function(){return $(this).data("tab")==activeTab}).addClass("active");
    this.find(".tab-button").click(function(){
        $(".tab-button.active").removeClass("active");
        $(this).addClass("active");
        var tab = $(this).data("tab");
        var tabs = $(this).parent().parent().find(".tab");
        tabs.removeClass("active").hide(0);
        tabs.filter(function(){return $(this).data("tab")==tab}).addClass("active").fadeIn(100);
    });
}
