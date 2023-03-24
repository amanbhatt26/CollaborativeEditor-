import { useEffect, useRef, useState } from "react";
import { EditorProps, EditorState, Element, Operation } from "../../types";
import * as Y from "yjs";
import {
  deleteCursorFromYArray,
  backspaceChar,
  elArraytoString,
  eventToOperation,
  insertToYArray,
  locateCursor,
  deleteChar,
  findCursorInsertPosOffset,
} from "../../utils";
import { EditorDisplay } from "./EditorDisplay";

export const Editor = ({
  id,
  roomName,
  editorName,
  backendURL,
  colorScheme,
}: EditorProps) => {
  const [dupArray, setDupArray] = useState<Element[] | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [state, setState] = useState<EditorState>({
    doc: null,
    array: null,
    socket:null 
  });
  const [socket, setSocket] = useState<WebSocket | null>(null);


  const handleOperation = (operation: Operation | null) => {
    if (operation === null) return;

    let cursorPos;
    switch (operation.type) {
      case "single":
        if (!operation.content) return;
        cursorPos = locateCursor(state.array, id);
        if (cursorPos !== -1)
          insertToYArray(state.array, cursorPos, operation.content[0]);
        break;

      case "backspace":
        cursorPos = locateCursor(state.array, id);
        backspaceChar(state.array, cursorPos);
        break;

      case "delete":
        cursorPos = locateCursor(state.array, id);
        deleteChar(state.array, cursorPos);
        break;

      default:
        console.log("operation not implemented");
    }
  };
  useEffect(() => {
    const doc = new Y.Doc();
    const array = doc.getArray<Element>(editorName);
    
    doc.on("update", ()=>{
      console.log(doc);
    })


    array.observe(() => {
      setDupArray(array.toJSON()); 
      const encodedStateUpdate:Uint8Array = Y.encodeStateAsUpdate(doc); 
      socket.send(encodedStateUpdate); 
    });

    const socket = new WebSocket(backendURL);
    socket.binaryType = "arraybuffer";

    socket.addEventListener('open', () => {
      console.log('WebSocket connection opened');
      setSocket(socket);
    });

    socket.addEventListener('close', () => {
      console.log('WebSocket connection closed');
      setSocket(null);
    });

    socket.addEventListener("message", (event)=>{
      console.log("doc change")
      const data = JSON.parse(event.data); 
      console.log(data);
      if(!data.type){
        console.log("Some error in the message syncing"); 
        return; 
      }

      
      let uint8Array; 
      switch(data.type){
        
        case "update":
          uint8Array = new Uint8Array(data.uint8Array.data);
          console.log("update", data.uint8Array.data); 
          if(doc) {
            Y.applyUpdate(doc, uint8Array);
          }
        break;

        case "init":
          uint8Array = new Uint8Array(data.uint8Array.data); 
          if(doc) {
            Y.applyUpdate(doc, uint8Array);
          }
        break;

        default:
          console.log("default message"); 
      }
      

       
    })
    
    setState({doc, array, socket});


    return () => {
      if (socket) {
        socket.close();
        setSocket(null);
      }
    };
  }, []);

  useEffect(() => {
    if (textRef === null || textRef.current === null) return;

    textRef.current.style.height = "auto";
    textRef.current.style.height = textRef.current.scrollHeight + "px";
    textRef.current.blur();
    textRef.current.focus();
  }, [dupArray]);

  return (
    <div className="w-fit h-fit p-[2rem] border-slate-600 border-[1px] mx-auto my-[2rem] text-[1.2rem]">
      <div className="w-[80vw] h-fit min-h-[100vh] relative">
        <div
          className="w-full h-fit min-h-[100%] box-border absolute top-0 left-0 whitespace-pre-wrap hover:cursor-text outline-none break-words"
          onClick={() => {
            textRef.current?.focus();
          }}
        >
          <EditorDisplay array={dupArray} cursorColor={colorScheme} />
        </div>

        <textarea
          ref={textRef}
          className="w-full h-full box-border absolute top-0 left-0 resize-none outline-none overflow-hidden bg-[rgba(0,0,0,0)] text-[rgba(0,0,0,0)] z-[10] break-words"
          spellCheck={false}
          value={elArraytoString(dupArray)}
          onClick={() => {
            if (!textRef.current) return;
            deleteCursorFromYArray(state.array, id);

            const insertPos =
              textRef.current.selectionStart +
              findCursorInsertPosOffset(
                state.array,
                textRef.current.selectionStart
              );
            insertToYArray(state.array, insertPos, {
              id,
              type: "cursor",
              color: colorScheme,
            });
          }}
          onKeyDown={(event) => {
            event.preventDefault();
            const operation = eventToOperation(event);
            handleOperation(operation);
          }}
        ></textarea>
      </div>
    </div>
  );
};