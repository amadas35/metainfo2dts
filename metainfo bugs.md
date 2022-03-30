### metainfo 잘못된 값
----------------------------------------------

#### 잘못된 타입
- EventSinkObject.info
	- setEventHandlerLookup: Argument Type - 3번째 인자 `strFunc` type = `object` --> `string` 이어야 함.
- Crypto.info
	- init : Argument Type - 1번째 인자 `nBit` type = `Integer` --> `Number`이어야 함.
- Object.info
	- getNumSetter, getSetter : All Argument Type (strFunc, strName) `object` --> `string` 이어야 함.
- EventInfo.info를 포함하는 모든 EventInfo 정의파일
	- fromobject / fromreferenceobject: `` --> `object`
- Component.info
	- `color` property type은 NamedColor Enum Type으로 하면 안되고 string type으로 되어야 함.
	- `setOffsetWidth( nWidth )` : nWidth type이 `Object`로 정의되어 있음
- Component.info, ChildFrame.info, FrameSet.info, HFrameSet.info, Form.info, MainFrame.info, TileFrameSet.info, VFrameSet.info, Combo.info, CompositeComponent.info, Dataset.info, Div.info, ...
	- `setEventHandlerLookup(strEventID, strFunc, objTarget)` : strFunc's type is setted `Object`
- ExcelExportObject.info
	- `commcompress`, `commdataformat` 등이 `edittype=Enum`이지만, `enuminfo` 또는 `enuminfo2`가 지정되어 있지 않음
	- `addExportItem(...)`: argument `constExportItemType` 의 type에 `Constant` 사용됨. (실제는 Enum인데, 정의할 필드가 없음)
	
#### Inheritance 부적합
- Environment.info, Application.info, Component.info, Dataset.info 등 EventSinkObject 상속 객체들
	- Inheritance 미지정 : nexacro.EventSinkObject 지정 필요
- XXXXEventInfo.info
	- Inheritance 미지정 : nexacro.EventInfo 지정 필요
	
#### metainfo module 위치 부적합
- framework에서 사용되는 EventInfo framework module로 이동
	- LoadEventInfo, KeyEventInfo, ExtendedCommandEventInfo, 
- tray용 eventinfo : framework으로 이동? component로 이동? nre용으로 분리?
	- InnerdataChangedEventInfo, MenuClickEventInfo, ClickEventInfo, TrayBalloonTipHideEventInfo, MouseEventInfo
- Component.info CompBase Module로 이동
	- InputEventInfo.info도 함께 이동
- IconTextControl.info CompBase Module로 이동 : TitleBarIconTextControl 때문
- TitleBarButtonControl.info (CompBase) : Super Class Button.info (ComComp)
	- TitleBarButtonControl의 super를 IconTextControl 드응로 변경할 수 는 없을까?
- CompBase.json에 ComComp Metainfo 파일이 링크되어 있음
	- ComComp/Compoent.info, ComComp/CompositeComponent.info

	
#### 중복 정의?
- EventInfo.info 
	- framework과 compbase에 중복 정의됨
	
#### 사용하지 않음
- Image.info
	- group=`Object_old` --> `Object`로 변경
- Position.info, Position2.Info : 사용하지 않는 타입
- UserEvent.info : 사용하지 않음
	
#### override type 상이함
- AnimationTimeline.info
	- addTarget의 Argument Type이 재정의됨 : overload 확장이 안되기 때문에, `overload` 와 같은 필드를 추가하거나 하여 omit 후 재정의하는 방법으로 처리해야 함.
- Component.info
	- init, insertEventHandler 함수 정의가 다름 (method 등록만 해두고 arguments 등을 정의하지 않았음)
	- addEvent, removeEvent 함수 정의가 다름 (method 등록만 해두고 arguments 등을 정의하지 않았음)
- ChildFrame.info
	- addEvent, removeEvent 함수 정의가 다름 (method 등록만 해두고 arguments 등을 정의하지 않았음)
	- setFocus() return type이 다름
- ChildFrame.info, FrameSet.info, HFrameSet.info, TileFrameSet.info, VFrameSet.info
	- setFocus() return type이 다름
- Component.info - IconTextControl.info (Position 속성)
	- Component.info:left = 'Positon'  -  IconTextControl.info:left = 'PositionBase'
	  --> PositionBase Type의 범위가 더 넓어서 재정의가 안됨
	  --> Component.info: left = 'PositionBase' 로 변경하면, Frame 등 'Position' type에도 문제없음.
- Component.info -- Component 상속 
	- init 함수의 syntax가 frame류와 component 류가 다름
	  --> Component.info에 init 함수를 Multi-Syntax를 지원하는 형식(--현재 미지원--)으로 변경하거나
	  --> FrameBase의 super를 추가 정의하는 방법으로 해결 가능함 : FrameBase에서 Omit<component, "init"> 후 init 재정의. (`overload`)
	  --> multi-syntax가 변별력을 가지려면, Argument 중에 일부에는 mandantory 설정이 되어 있어야 함.
	
#### Object ID/inheritance 정보와 classname이 불일치하는 경우 
- nexacro interface에는 classname 사용하고, namespace에는 id를 사용하면 회피가 가능?
	- event handler의 argument에 classname을 사용해야 하므로, event handler syntax를 parsing해서 사용하는 현재방식으로는 잘못된 type 지정이 발생하게 됨.
		--> 추후, 누락된 argument type을 추가하면 해결 가능하려나?

#### Module.json에 누락
- ComComp.json: DataObjectDataChangedEventInfo.info -> 소스에 있는 json에는 포함되어 있으나 배포에는 빠짐?
- ComComp.json: DataObjectValueChangedEventInfo.info -> 소스에 있는 json에는 포함되어 있으나 배포에는 빠짐?
- ComComp.json: FileUploadContextMenuEventInfo.info
- ComComp.json: MenuContextMenuEventInfo.info
- Grid.json: GridKeyEventInfo.info
- Grid.json: GridContextMenuEventInfo.info ( 이 파일은 ComComp에 있음 )
- ListView.json: ListViewEditEventInfo.info
- ListView.json: ListViewContextMenuEventInfo.info ( 이 파일은 ComComp에 있음 )

#### metainfo 정의 오류
- PopupMenu.info
	- trackPopup, trackPopupByComponent : argument 'strAlign'이 Argument Tag에 없고, strAlign의 값 요소 (<hAlign> <vAlign>) 항목이 포함되어 있음.
	- trackPopupByComponent : `nYpos` Argument Tag가 없음 
- GraphicsEllipse.info
	- height' 속성만 두번 정의되어 있음. TOPS 확인결과, width 속성 정의에 이름이 `height`로 되어 있음

#### metainfo 에 정의 없음
- 'trace' / 'alert' : global api.
	```
	declare global {
		function trace(...args: any[]): void;
    	function alert(...args: any[]): void;
	}
	```
