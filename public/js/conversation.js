// The ConversationPanel module is designed to handle
// all display and behaviors of the conversation column of the app.
/* eslint no-unused-vars: "off" */
/* global Api: true, Common: true*/




var ConversationPanel = (function () {
  var settings = {
    selectors: {
      chatBox: '#scrollingChat',
      fromUser: '.from-user',
      fromWatson: '.from-watson',
      latest: '.latest'
    },
    authorTypes: {
      user: 'user',
      watson: 'watson'
    }
  };
  
  // Publicly accessible methods defined
  return {
    init: init,
    inputKeyDown: inputKeyDown,
    sendMessage: sendMessage,
    //sendCopy:sendCopy,
    Clipboard:Clipboard
    //copy:copy,
    //clipboard:clipboard
  };

  // Initialize the module
  function init() {
    chatUpdateSetup();
    Api.getSessionId(function() {
      Api.sendRequest('', null);
    });
    setupInputBox();
  }
  // Set up callbacks on payload setters in Api module
  // This causes the displayMessage function to be called when messages are sent / received
  function chatUpdateSetup() {
    var currentRequestPayloadSetter = Api.setRequestPayload;
    Api.setRequestPayload = function (newPayloadStr) {
      currentRequestPayloadSetter.call(Api, newPayloadStr);
      displayMessage(JSON.parse(newPayloadStr), settings.authorTypes.user);
    };

    var currentResponsePayloadSetter = Api.setResponsePayload;
    Api.setResponsePayload = function (newPayloadStr) {
      currentResponsePayloadSetter.call(Api, newPayloadStr);
      displayMessage(JSON.parse(newPayloadStr), settings.authorTypes.watson);
    };

    Api.setErrorPayload = function (newPayload) {
      displayMessage(newPayload, settings.authorTypes.watson);
    };
  }

  // Set up the input box to underline text as it is typed
  // This is done by creating a hidden dummy version of the input box that
  // is used to determine what the width of the input text should be.
  // This value is then used to set the new width of the visible input box.
  function setupInputBox() {
    var input = document.getElementById('textInput');
    var dummy = document.getElementById('textInputDummy');
    var minFontSize = 14;
    var maxFontSize = 16;
    var minPadding = 4;
    var maxPadding = 6;

    // If no dummy input box exists, create one
    if (dummy === null) {
      var dummyJson = {
        'tagName': 'div',
        'attributes': [{
          'name': 'id',
          'value': 'textInputDummy'
        }],
      };

      dummy = Common.buildDomElement(dummyJson);
      document.body.appendChild(dummy);
    }

    function adjustInput() {
      if (input.value === '') {
        // If the input box is empty, remove the underline
        input.classList.remove('underline');
        input.setAttribute('style', 'width:' + '100%');
        input.style.width = '100%';
      } else {
        // otherwise, adjust the dummy text to match, and then set the width of
        // the visible input box to match it (thus extending the underline)
        input.classList.add('underline');
        var txtNode = document.createTextNode(input.value);
        ['font-size', 'font-style', 'font-weight', 'font-family', 'line-height',
          'text-transform', 'letter-spacing'
        ].forEach(function (index) {
          dummy.style[index] = window.getComputedStyle(input, null).getPropertyValue(index);
        });
        dummy.textContent = txtNode.textContent;

        var padding = 0;
        var htmlElem = document.getElementsByTagName('html')[0];
        var currentFontSize = parseInt(window.getComputedStyle(htmlElem, null).getPropertyValue('font-size'), 10);
        if (currentFontSize) {
          padding = Math.floor((currentFontSize - minFontSize) / (maxFontSize - minFontSize) *
            (maxPadding - minPadding) + minPadding);
        } else {
          padding = maxPadding;
        }

        var widthValue = (dummy.offsetWidth + padding) + 'px';
        input.setAttribute('style', 'width:' + widthValue);
        input.style.width = widthValue;
      }
    }

    // Any time the input changes, or the window resizes, adjust the size of the input box
    input.addEventListener('input', adjustInput);
    window.addEventListener('resize', adjustInput);

    // Trigger the input event once to set up the input box and dummy element
    Common.fireEvent(input, 'input');
  }

  // Display a user or Watson message that has just been sent/received
  function displayMessage(newPayload, typeValue) {
    var isUser = isUserMessage(typeValue);
    //var textExists = newPayload.generic;
    if ((newPayload.output && newPayload.output.generic) ||  newPayload.input){
      // Create new message generic elements
      var responses = buildMessageDomElements(newPayload, isUser);
      var chatBoxElement = document.querySelector(settings.selectors.chatBox);
      var previousLatest = chatBoxElement.querySelectorAll((isUser ? settings.selectors.fromUser : settings.selectors.fromWatson) +
        settings.selectors.latest);
      // Previous "latest" message is no longer the most recent
      if (previousLatest) {
        Common.listForEach(previousLatest, function (element) {
          element.classList.remove('latest');
        });
      }
      setResponse(responses, isUser, chatBoxElement, 0, true);
    }
  }

  // Recurisive function to add responses to the chat area
  function setResponse(responses, isUser, chatBoxElement, index, isTop) {
    if (index < responses.length) {
      var res = responses[index];
      if (res.type !== 'pause') {
        var currentDiv = getDivObject(res, isUser, isTop);
        chatBoxElement.appendChild(currentDiv);
        // Class to start fade in animation
        currentDiv.classList.add('load');
        // Move chat to the most recent messages when new messages are added
        setTimeout(function () {
          // wait a sec before scrolling
          scrollToChatBottom();
        }, 1000);
        setResponse(responses, isUser, chatBoxElement, index + 1, false);
      } else {
        var userTypringField = document.getElementById('user-typing-field');
        if (res.typing) {
          userTypringField.innerHTML = 'Watson Assistant Typing...';
        }
        setTimeout(function () {
          userTypringField.innerHTML = '';
          setResponse(responses, isUser, chatBoxElement, index + 1, isTop);
        }, res.time);
      }
    }
  }

  // Constructs new DOM element from a message
  function getDivObject(res, isUser, isTop) {
    var classes = [(isUser ? 'from-user' : 'from-watson'), 'latest', (isTop ? 'top' : 'sub')];
    var messageJson = {
      // <div class='segments'>
      'tagName': 'div',
      'classNames': ['segments'],
      'children': [{
        // <div class='from-user/from-watson latest'>
        'tagName': 'div',
        'classNames': classes,
        'children': [{
          // <div class='message-inner'>
          'tagName': 'div',
          'classNames': ['message-inner'],
          
          'children': [{
       // <p>{messageText}</p>
            'tagName': 'p',

            // 'children': [{

            //   'text': 'Copy',
            //   'button id' :  'ibutton',
            //   'tagName': 'button',

            // }],

            'text': res.innerhtml,
            
             
          }],
          
         
        }]


        }]
       
   
}
//dynamicButton();
    return Common.buildDomElement(messageJson);

  }

  // function dynamicButton(){
  //   var ibutton = document.createElement("Button");
  //   ibutton.className = "ibutton";
  //   ibutton.innerHTML = "Copy";
  //   document.getElementsByClassName('message-inner').appendChild('ibutton');
  // }



  // Checks if the given typeValue matches with the user "name", the Watson "name", or neither
  // Returns true if user, false if Watson, and null if neither
  // Used to keep track of whether a message was from the user or Watson
  function isUserMessage(typeValue) {
    if (typeValue === settings.authorTypes.user) {
      return true;
    } else if (typeValue === settings.authorTypes.watson) {
      return false;
    }
    return null;
  }

function getButtondesc(description){
  var desc;
  var dsc = (description.replace('<div>','')).replace('</div>','');
console.log(dsc);
  if(dsc === undefined || dsc=== '' || dsc==='<div></div>' ){
    console.log('inside if');
    desc = '';
  }
  else{
    console.log('inside else');
  //var idiscription = document.createElement("Button");


  desc= '<div class="Wrapper" style="width:100%" >' +  dsc   + '\</div>'
  // <i class="fa fa-copy"></i></div>'
  console.log(desc); }
 return desc;
}

function getButtontext(text){
  var txt;
  
  console.log(text); 
  
  if(text === undefined || text=== '' || text==='<div></div>' ){
    console.log('inside if');
    txt = '';
  }else{
 
  txt= '<div style="width:100%">' +  text  + '<button style="height:35px;width:5%;font-size=40px;" class="btn btn-default" onclick="ConversationPanel.Clipboard(\'' +
  text + '\');"><i class="fa fa-copy"></i></div>'
   
  }
 return txt;

}



  function getOptions(optionsList, preference) {
    var list = '';
    var i = 0;
    if (optionsList !== null) {
      if (preference === 'text') {
        list = '<ul>';
        for (i = 0; i < optionsList.length; i++) {
          if (optionsList[i].value) {
            list += '<li><div class="options-list" onclick="ConversationPanel.sendMessage(\'' +
            optionsList[i].value.input.text + '\');" >' + optionsList[i].label + '</div></li>';
          }
        }
        list += '</ul>';
      } else if (preference === 'button') 

      {
        list = '<div id="cnfrmBtn" class="chat-option-list">';
        var len = 0;
        for (i = 0; i < optionsList.length; i++) {
          var val = new String(optionsList[i].value);
          len = val.length;
          // console.log(len);
          if(optionsList[i].value.length > len){
          len = optionsList[i].value.length;
                                               }
       
        }
   

        for (i = 0; i < optionsList.length; i++) {


          if (optionsList[i].value) {
            // console.log(" +++ "+optionsList[i].value+" == "+i);
            
            // console.log("before click Value of x : "+x);
            
            var item = '<div class= "col-lg-6"> <button id="'+i+'\" class="ibm-type-b chat-option__button"; max-width:len; style="height:30px;width:100%;font-size=40px;disabled" onclick="ConversationPanel.sendMessage(\'' +
              optionsList[i].value.input.text+ '\' , \''+i+ '\' , \'' +optionsList.length + '\');">' + optionsList[i].label+'</button>';
              list += item;
              list += '</div>';
              
              
          }
          
        }
        list += '</div>';
        
      }
 
      else if (preference === 'historyButton') {
        list='<div id="cnfrmBtn" class="chat-option-list">';
        for (i = 0; i < optionsList.length; i++) {
          if (optionsList[i].value) {
            list+='<button class="ibm-type-b chat-option__button" onClick="ServicePanel.onButtonSubmit(\'' + optionsList[i].value.input.text + '\');">' + optionsList[i].label + '</button>';
          }
        }
      list += '</div>';
      }
    }
    return list;
  }

  function getResponse(responses, gen) {
    var title = '', description = '';
    if (gen.hasOwnProperty('title')) {
      title = gen.title;
    }
    if (gen.hasOwnProperty('description')) {
      description = gen.description;
    }
    if (gen.response_type === 'image') {
      var options=gen.source;
      options=filePath+options;
      if(title=='Image')
      {
        img='<img style="width:100% ; object-fit: fill ;" src=\''+options+'\' onclick=window.open(\''+options+'\') ;></img>';
      }
      else
      {
        img="<iframe src="+ options +" style='width:100%; height:90%;' frameborder='0'></iframe>";
      }
      responses.push({
        type: gen.response_type,
        innerhtml: title + description + img
      });
    } else if (gen.response_type === 'text') {
      var text = getButtontext(gen.text);
     
      responses.push({
        type: gen.response_type,

        innerhtml: text
      });
    } else if (gen.response_type === 'pause') {
      responses.push({
        type: gen.response_type,
        time: gen.time,
        typing: gen.typing
      });
    } else if (gen.response_type === 'option') {
      var preference = 'button';
      if (gen.hasOwnProperty('preference')) {
        preference = gen.preference;
      }

      var list = getOptions(gen.options, preference);
      var descriptions = getButtondesc(description);
      responses.push({
        type: gen.response_type,
        innerhtml: title + descriptions + list,
     
      });

      console.log(description);
    }
  }


  // Constructs new generic elements from a message payload
  function buildMessageDomElements(newPayload, isUser) {
    var textArray = isUser ? newPayload.input.text : newPayload.output.text;
    if (Object.prototype.toString.call(textArray) !== '[object Array]') {
      textArray = [textArray];
    }

    var responses = [];

    if (newPayload.hasOwnProperty('output')) {
      if (newPayload.output.hasOwnProperty('generic')) {

        var generic = newPayload.output.generic;

        generic.forEach(function (gen) {
          getResponse(responses, gen);
        });
      }
    } else if (newPayload.hasOwnProperty('input')) {
      var input = '';
      textArray.forEach(function (msg) {
        input += msg + ' ';
      });
      input = input.trim()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      if (input.length !== 0) {
        responses.push({
          type: 'text',
          innerhtml: input
        });
      }
    }
    return responses;
  }

  // Scroll to the bottom of the chat window
  function scrollToChatBottom() {
    var scrollingChat = document.querySelector('#scrollingChat');
    scrollingChat.scrollTop = scrollingChat.scrollHeight;
  }

  function sendMessage(text , Newid , len) {
    
    // console.log(text, id, len);
  
    // Retrieve the context from the previous server response

    Newid = 0;
    for(i=0; i < len ; i++)
    { 
      console.log(Newid);
       document.querySelectorAll('button.className').forEach(elem =>{elem.disable = true}); 
      Newid+=1;
    }
    
    var context;
    var latestResponse = Api.getResponsePayload();
    if (latestResponse) {
      context = latestResponse.context;
    }
    // Send the user message
  
    Api.sendRequest(text, context);
  }

  // Handles the submission of input
  function inputKeyDown(event, inputBox) {
    // Submit on enter key, dis-allowing blank messages
    if (event.keyCode === 13 && inputBox.value) {
      sendMessage(inputBox.value);
      // Clear input box for further messages
      inputBox.value = '';
      Common.fireEvent(inputBox, 'input');
    }
  }

  function Clipboard(text,description) {

    //alert(text, description);
console.log("Hello");
    if(text)
    {
      console.log("Welcome");
      text = text.replace("'" , "\'");
      var temp = text
      console.log("HelloWelcome"+temp);
    //alert($temp);
    var content = '`' + $('<input>').val(temp).appendTo('body').select() + '`';
    
    document.execCommand("copy");
    }

    else
    {
     // var temp= description
      description = description.replace(/'/ , "//'");
      var temp = description;
    

      var content ='`' + $('<input>').val(temp).appendTo('body').select() + '`';
      document.execCommand("copy");
    }
 }
}());
