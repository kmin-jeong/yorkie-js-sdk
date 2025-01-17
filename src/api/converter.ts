/*
 * Copyright 2020 The Yorkie Authors. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Long from 'long';
import { Code, YorkieError } from '@yorkie-js-sdk/src/util/error';
import { PresenceInfo } from '@yorkie-js-sdk/src/core/client';
import {
  InitialTimeTicket,
  TimeTicket,
} from '@yorkie-js-sdk/src/document/time/ticket';
import { Operation } from '@yorkie-js-sdk/src/document/operation/operation';
import { SetOperation } from '@yorkie-js-sdk/src/document/operation/set_operation';
import { AddOperation } from '@yorkie-js-sdk/src/document/operation/add_operation';
import { MoveOperation } from '@yorkie-js-sdk/src/document/operation/move_operation';
import { RemoveOperation } from '@yorkie-js-sdk/src/document/operation/remove_operation';
import { EditOperation } from '@yorkie-js-sdk/src/document/operation/edit_operation';
import { RichEditOperation } from '@yorkie-js-sdk/src/document/operation/rich_edit_operation';
import { SelectOperation } from '@yorkie-js-sdk/src/document/operation/select_operation';
import { StyleOperation } from '@yorkie-js-sdk/src/document/operation/style_operation';
import { ChangeID } from '@yorkie-js-sdk/src/document/change/change_id';
import { Change } from '@yorkie-js-sdk/src/document/change/change';
import { ChangePack } from '@yorkie-js-sdk/src/document/change/change_pack';
import { Checkpoint } from '@yorkie-js-sdk/src/document/change/checkpoint';
import { RHTPQMap } from '@yorkie-js-sdk/src/document/json/rht_pq_map';
import { RGATreeList } from '@yorkie-js-sdk/src/document/json/rga_tree_list';
import { JSONElement } from '@yorkie-js-sdk/src/document/json/element';
import { ObjectInternal } from '@yorkie-js-sdk/src/document/json/object';
import { ArrayInternal } from '@yorkie-js-sdk/src/document/json/array';
import {
  RGATreeSplit,
  RGATreeSplitNode,
  RGATreeSplitNodeID,
  RGATreeSplitNodePos,
} from '@yorkie-js-sdk/src/document/json/rga_tree_split';
import { PlainTextInternal } from '@yorkie-js-sdk/src/document/json/plain_text';
import {
  RichTextInternal,
  RichTextValue,
} from '@yorkie-js-sdk/src/document/json/rich_text';
import {
  JSONPrimitive,
  PrimitiveType,
} from '@yorkie-js-sdk/src/document/json/primitive';
import {
  Change as PbChange,
  ChangeID as PbChangeID,
  ChangePack as PbChangePack,
  Checkpoint as PbCheckpoint,
  Client as PbClient,
  Presence as PbPresence,
  JSONElement as PbJSONElement,
  JSONElementSimple as PbJSONElementSimple,
  Operation as PbOperation,
  RGANode as PbRGANode,
  RHTNode as PbRHTNode,
  RichTextNode as PbRichTextNode,
  TextNode as PbTextNode,
  TextNodeID as PbTextNodeID,
  TextNodePos as PbTextNodePos,
  TimeTicket as PbTimeTicket,
  ValueType as PbValueType,
} from '@yorkie-js-sdk/src/api/resources_pb';
import { IncreaseOperation } from '@yorkie-js-sdk/src/document/operation/increase_operation';
import {
  CounterType,
  CounterInternal,
} from '@yorkie-js-sdk/src/document/json/counter';

/**
 * `fromPresence` converts the given Protobuf format to model format.
 */
function fromPresence<M>(pbPresence: PbPresence): PresenceInfo<M> {
  const data: Record<string, string> = {};
  pbPresence.getDataMap().forEach((value: string, key: string) => {
    data[key] = value;
  });

  return {
    clock: pbPresence.getClock(),
    data: data as any,
  };
}

/**
 * `toClient` converts the given model to Protobuf format.
 */
function toClient<M>(id: string, presence: PresenceInfo<M>): PbClient {
  const pbPresence = new PbPresence();
  pbPresence.setClock(presence.clock);
  const pbDataMap = pbPresence.getDataMap();
  for (const [key, value] of Object.entries(presence.data)) {
    pbDataMap.set(key, value);
  }

  const pbClient = new PbClient();
  pbClient.setId(toUint8Array(id));
  pbClient.setPresence(pbPresence);
  return pbClient;
}

/**
 * `toCheckpoint` converts the given model to Protobuf format.
 */
function toCheckpoint(checkpoint: Checkpoint): PbCheckpoint {
  const pbCheckpoint = new PbCheckpoint();
  pbCheckpoint.setServerSeq(checkpoint.getServerSeqAsString());
  pbCheckpoint.setClientSeq(checkpoint.getClientSeq());
  return pbCheckpoint;
}

/**
 * `toChangeID` converts the given model to Protobuf format.
 */
function toChangeID(changeID: ChangeID): PbChangeID {
  const pbChangeID = new PbChangeID();
  pbChangeID.setClientSeq(changeID.getClientSeq());
  pbChangeID.setLamport(changeID.getLamportAsString());
  pbChangeID.setActorId(toUint8Array(changeID.getActorID()!));
  return pbChangeID;
}

/**
 * `toTimeTicket` converts the given model to Protobuf format.
 */
function toTimeTicket(ticket?: TimeTicket): PbTimeTicket | undefined {
  if (!ticket) {
    return;
  }

  const pbTimeTicket = new PbTimeTicket();
  pbTimeTicket.setLamport(ticket.getLamportAsString());
  pbTimeTicket.setDelimiter(ticket.getDelimiter());
  pbTimeTicket.setActorId(toUint8Array(ticket.getActorID()!));
  return pbTimeTicket;
}

/**
 * `toValueType` converts the given model to Protobuf format.
 */
function toValueType(valueType: PrimitiveType): PbValueType {
  switch (valueType) {
    case PrimitiveType.Null:
      return PbValueType.NULL;
    case PrimitiveType.Boolean:
      return PbValueType.BOOLEAN;
    case PrimitiveType.Integer:
      return PbValueType.INTEGER;
    case PrimitiveType.Long:
      return PbValueType.LONG;
    case PrimitiveType.Double:
      return PbValueType.DOUBLE;
    case PrimitiveType.String:
      return PbValueType.STRING;
    case PrimitiveType.Bytes:
      return PbValueType.BYTES;
    case PrimitiveType.Date:
      return PbValueType.DATE;
    default:
      throw new YorkieError(Code.Unsupported, `unsupported type: ${valueType}`);
  }
}

/**
 * `toCounterType` converts the given model to Protobuf format.
 */
function toCounterType(valueType: CounterType): PbValueType {
  switch (valueType) {
    case CounterType.IntegerCnt:
      return PbValueType.INTEGER_CNT;
    case CounterType.LongCnt:
      return PbValueType.LONG_CNT;
    case CounterType.DoubleCnt:
      return PbValueType.DOUBLE_CNT;
    default:
      throw new YorkieError(Code.Unsupported, `unsupported type: ${valueType}`);
  }
}

/**
 * `toJSONElementSimple` converts the given model to Protobuf format.
 */
function toJSONElementSimple(jsonElement: JSONElement): PbJSONElementSimple {
  const pbJSONElement = new PbJSONElementSimple();
  if (jsonElement instanceof ObjectInternal) {
    pbJSONElement.setType(PbValueType.JSON_OBJECT);
    pbJSONElement.setCreatedAt(toTimeTicket(jsonElement.getCreatedAt()));
  } else if (jsonElement instanceof ArrayInternal) {
    pbJSONElement.setType(PbValueType.JSON_ARRAY);
    pbJSONElement.setCreatedAt(toTimeTicket(jsonElement.getCreatedAt()));
  } else if (jsonElement instanceof PlainTextInternal) {
    pbJSONElement.setType(PbValueType.TEXT);
    pbJSONElement.setCreatedAt(toTimeTicket(jsonElement.getCreatedAt()));
  } else if (jsonElement instanceof RichTextInternal) {
    pbJSONElement.setType(PbValueType.RICH_TEXT);
    pbJSONElement.setCreatedAt(toTimeTicket(jsonElement.getCreatedAt()));
  } else if (jsonElement instanceof JSONPrimitive) {
    const primitive = jsonElement as JSONPrimitive;
    pbJSONElement.setType(toValueType(primitive.getType()));
    pbJSONElement.setCreatedAt(toTimeTicket(jsonElement.getCreatedAt()));
    pbJSONElement.setValue(jsonElement.toBytes());
  } else if (jsonElement instanceof CounterInternal) {
    const counter = jsonElement as CounterInternal;
    pbJSONElement.setType(toCounterType(counter.getType()));
    pbJSONElement.setCreatedAt(toTimeTicket(jsonElement.getCreatedAt()));
    pbJSONElement.setValue(jsonElement.toBytes());
  } else {
    throw new YorkieError(
      Code.Unimplemented,
      `unimplemented element: ${jsonElement}`,
    );
  }

  return pbJSONElement;
}

/**
 * `toTextNodeID` converts the given model to Protobuf format.
 */
function toTextNodeID(id: RGATreeSplitNodeID): PbTextNodeID {
  const pbTextNodeID = new PbTextNodeID();
  pbTextNodeID.setCreatedAt(toTimeTicket(id.getCreatedAt()));
  pbTextNodeID.setOffset(id.getOffset());
  return pbTextNodeID;
}

/**
 * `toTextNodePos` converts the given model to Protobuf format.
 */
function toTextNodePos(pos: RGATreeSplitNodePos): PbTextNodePos {
  const pbTextNodePos = new PbTextNodePos();
  pbTextNodePos.setCreatedAt(toTimeTicket(pos.getID().getCreatedAt()));
  pbTextNodePos.setOffset(pos.getID().getOffset());
  pbTextNodePos.setRelativeOffset(pos.getRelativeOffset());
  return pbTextNodePos;
}

/**
 * `toOperation` converts the given model to Protobuf format.
 */
function toOperation(operation: Operation): PbOperation {
  const pbOperation = new PbOperation();

  if (operation instanceof SetOperation) {
    const setOperation = operation as SetOperation;
    const pbSetOperation = new PbOperation.Set();
    pbSetOperation.setParentCreatedAt(
      toTimeTicket(setOperation.getParentCreatedAt()),
    );
    pbSetOperation.setKey(setOperation.getKey());
    pbSetOperation.setValue(toJSONElementSimple(setOperation.getValue()));
    pbSetOperation.setExecutedAt(toTimeTicket(setOperation.getExecutedAt()));
    pbOperation.setSet(pbSetOperation);
  } else if (operation instanceof AddOperation) {
    const addOperation = operation as AddOperation;
    const pbAddOperation = new PbOperation.Add();
    pbAddOperation.setParentCreatedAt(
      toTimeTicket(addOperation.getParentCreatedAt()),
    );
    pbAddOperation.setPrevCreatedAt(
      toTimeTicket(addOperation.getPrevCreatedAt()),
    );
    pbAddOperation.setValue(toJSONElementSimple(addOperation.getValue()));
    pbAddOperation.setExecutedAt(toTimeTicket(addOperation.getExecutedAt()));
    pbOperation.setAdd(pbAddOperation);
  } else if (operation instanceof MoveOperation) {
    const moveOperation = operation as MoveOperation;
    const pbMoveOperation = new PbOperation.Move();
    pbMoveOperation.setParentCreatedAt(
      toTimeTicket(moveOperation.getParentCreatedAt()),
    );
    pbMoveOperation.setPrevCreatedAt(
      toTimeTicket(moveOperation.getPrevCreatedAt()),
    );
    pbMoveOperation.setCreatedAt(toTimeTicket(moveOperation.getCreatedAt()));
    pbMoveOperation.setExecutedAt(toTimeTicket(moveOperation.getExecutedAt()));
    pbOperation.setMove(pbMoveOperation);
  } else if (operation instanceof RemoveOperation) {
    const removeOperation = operation as RemoveOperation;
    const pbRemoveOperation = new PbOperation.Remove();
    pbRemoveOperation.setParentCreatedAt(
      toTimeTicket(removeOperation.getParentCreatedAt()),
    );
    pbRemoveOperation.setCreatedAt(
      toTimeTicket(removeOperation.getCreatedAt()),
    );
    pbRemoveOperation.setExecutedAt(
      toTimeTicket(removeOperation.getExecutedAt()),
    );
    pbOperation.setRemove(pbRemoveOperation);
  } else if (operation instanceof EditOperation) {
    const editOperation = operation as EditOperation;
    const pbEditOperation = new PbOperation.Edit();
    pbEditOperation.setParentCreatedAt(
      toTimeTicket(editOperation.getParentCreatedAt()),
    );
    pbEditOperation.setFrom(toTextNodePos(editOperation.getFromPos()));
    pbEditOperation.setTo(toTextNodePos(editOperation.getToPos()));
    const pbCreatedAtMapByActor = pbEditOperation.getCreatedAtMapByActorMap();
    for (const [key, value] of editOperation.getMaxCreatedAtMapByActor()) {
      pbCreatedAtMapByActor.set(key, toTimeTicket(value)!);
    }
    pbEditOperation.setContent(editOperation.getContent());
    pbEditOperation.setExecutedAt(toTimeTicket(editOperation.getExecutedAt()));
    pbOperation.setEdit(pbEditOperation);
  } else if (operation instanceof SelectOperation) {
    const selectOperation = operation as SelectOperation;
    const pbSelectOperation = new PbOperation.Select();
    pbSelectOperation.setParentCreatedAt(
      toTimeTicket(selectOperation.getParentCreatedAt()),
    );
    pbSelectOperation.setFrom(toTextNodePos(selectOperation.getFromPos()));
    pbSelectOperation.setTo(toTextNodePos(selectOperation.getToPos()));
    pbSelectOperation.setExecutedAt(
      toTimeTicket(selectOperation.getExecutedAt()),
    );
    pbOperation.setSelect(pbSelectOperation);
  } else if (operation instanceof RichEditOperation) {
    const richEditOperation = operation as RichEditOperation;
    const pbRichEditOperation = new PbOperation.RichEdit();
    pbRichEditOperation.setParentCreatedAt(
      toTimeTicket(richEditOperation.getParentCreatedAt()),
    );
    pbRichEditOperation.setFrom(toTextNodePos(richEditOperation.getFromPos()));
    pbRichEditOperation.setTo(toTextNodePos(richEditOperation.getToPos()));
    const pbCreatedAtMapByActor =
      pbRichEditOperation.getCreatedAtMapByActorMap();
    for (const [key, value] of richEditOperation.getMaxCreatedAtMapByActor()) {
      pbCreatedAtMapByActor.set(key, toTimeTicket(value)!);
    }
    pbRichEditOperation.setContent(richEditOperation.getContent());
    const pbAttributes = pbRichEditOperation.getAttributesMap();
    for (const [key, value] of richEditOperation.getAttributes()) {
      pbAttributes.set(key, value);
    }
    pbRichEditOperation.setExecutedAt(
      toTimeTicket(richEditOperation.getExecutedAt()),
    );
    pbOperation.setRichEdit(pbRichEditOperation);
  } else if (operation instanceof StyleOperation) {
    const styleOperation = operation as StyleOperation;
    const pbStyleOperation = new PbOperation.Style();
    pbStyleOperation.setParentCreatedAt(
      toTimeTicket(styleOperation.getParentCreatedAt()),
    );
    pbStyleOperation.setFrom(toTextNodePos(styleOperation.getFromPos()));
    pbStyleOperation.setTo(toTextNodePos(styleOperation.getToPos()));
    const pbAttributes = pbStyleOperation.getAttributesMap();
    for (const [key, value] of styleOperation.getAttributes()) {
      pbAttributes.set(key, value);
    }
    pbStyleOperation.setExecutedAt(
      toTimeTicket(styleOperation.getExecutedAt()),
    );
    pbOperation.setStyle(pbStyleOperation);
  } else if (operation instanceof IncreaseOperation) {
    const increaseOperation = operation as IncreaseOperation;
    const pbIncreaseOperation = new PbOperation.Increase();
    pbIncreaseOperation.setParentCreatedAt(
      toTimeTicket(increaseOperation.getParentCreatedAt()),
    );
    pbIncreaseOperation.setValue(
      toJSONElementSimple(increaseOperation.getValue()),
    );
    pbIncreaseOperation.setExecutedAt(
      toTimeTicket(increaseOperation.getExecutedAt()),
    );
    pbOperation.setIncrease(pbIncreaseOperation);
  } else {
    throw new YorkieError(Code.Unimplemented, 'unimplemented operation');
  }

  return pbOperation;
}

/**
 * `toOperations` converts the given model to Protobuf format.
 */
function toOperations(operations: Array<Operation>): Array<PbOperation> {
  const pbOperations = [];
  for (const operation of operations) {
    pbOperations.push(toOperation(operation));
  }
  return pbOperations;
}

/**
 * `toChange` converts the given model to Protobuf format.
 */
function toChange(change: Change): PbChange {
  const pbChange = new PbChange();
  pbChange.setId(toChangeID(change.getID()));
  pbChange.setMessage(change.getMessage()!);
  pbChange.setOperationsList(toOperations(change.getOperations()));
  return pbChange;
}

/**
 * `toChanges` converts the given model to Protobuf format.
 */
function toChanges(changes: Array<Change>): Array<PbChange> {
  const pbChanges = [];
  for (const change of changes) {
    pbChanges.push(toChange(change));
  }
  return pbChanges;
}

/**
 * `toRHTNodes` converts the given model to Protobuf format.
 */
function toRHTNodes(rht: RHTPQMap): Array<PbRHTNode> {
  const pbRHTNodes = [];
  for (const rhtNode of rht) {
    const pbRHTNode = new PbRHTNode();
    pbRHTNode.setKey(rhtNode.getStrKey());
    // eslint-disable-next-line
    pbRHTNode.setElement(toJSONElement(rhtNode.getValue()));
    pbRHTNodes.push(pbRHTNode);
  }

  return pbRHTNodes;
}

/**
 * `toRGANodes` converts the given model to Protobuf format.
 */
function toRGANodes(rgaTreeList: RGATreeList): Array<PbRGANode> {
  const pbRGANodes = [];
  for (const rgaTreeListNode of rgaTreeList) {
    const pbRGANode = new PbRGANode();
    // eslint-disable-next-line
    pbRGANode.setElement(toJSONElement(rgaTreeListNode.getValue()));
    pbRGANodes.push(pbRGANode);
  }

  return pbRGANodes;
}

/**
 * `toTextNodes` converts the given model to Protobuf format.
 */
function toTextNodes(rgaTreeSplit: RGATreeSplit<string>): Array<PbTextNode> {
  const pbTextNodes = [];
  for (const textNode of rgaTreeSplit) {
    const pbTextNode = new PbTextNode();
    pbTextNode.setId(toTextNodeID(textNode.getID()));
    pbTextNode.setValue(textNode.getValue());
    pbTextNode.setRemovedAt(toTimeTicket(textNode.getRemovedAt()));

    pbTextNodes.push(pbTextNode);
  }

  return pbTextNodes;
}

/**
 * `toJSONObject` converts the given model to Protobuf format.
 */
function toJSONObject(obj: ObjectInternal): PbJSONElement {
  const pbJSONObject = new PbJSONElement.JSONObject();
  pbJSONObject.setNodesList(toRHTNodes(obj.getRHT()));
  pbJSONObject.setCreatedAt(toTimeTicket(obj.getCreatedAt()));
  pbJSONObject.setMovedAt(toTimeTicket(obj.getMovedAt()));
  pbJSONObject.setRemovedAt(toTimeTicket(obj.getRemovedAt()));

  const pbJSONElement = new PbJSONElement();
  pbJSONElement.setJsonObject(pbJSONObject);
  return pbJSONElement;
}

/**
 * `toJSONArray` converts the given model to Protobuf format.
 */
function toJSONArray(arr: ArrayInternal): PbJSONElement {
  const pbJSONArray = new PbJSONElement.JSONArray();
  pbJSONArray.setNodesList(toRGANodes(arr.getElements()));
  pbJSONArray.setCreatedAt(toTimeTicket(arr.getCreatedAt()));
  pbJSONArray.setMovedAt(toTimeTicket(arr.getMovedAt()));
  pbJSONArray.setRemovedAt(toTimeTicket(arr.getRemovedAt()));

  const pbJSONElement = new PbJSONElement();
  pbJSONElement.setJsonArray(pbJSONArray);
  return pbJSONElement;
}

/**
 * `toJSONPrimitive` converts the given model to Protobuf format.
 */
function toJSONPrimitive(primitive: JSONPrimitive): PbJSONElement {
  const pbJSONPrimitive = new PbJSONElement.Primitive();
  pbJSONPrimitive.setType(toValueType(primitive.getType()));
  pbJSONPrimitive.setValue(primitive.toBytes());
  pbJSONPrimitive.setCreatedAt(toTimeTicket(primitive.getCreatedAt()));
  pbJSONPrimitive.setMovedAt(toTimeTicket(primitive.getMovedAt()));
  pbJSONPrimitive.setRemovedAt(toTimeTicket(primitive.getRemovedAt()));

  const pbJSONElement = new PbJSONElement();
  pbJSONElement.setPrimitive(pbJSONPrimitive);
  return pbJSONElement;
}

/**
 * `toPlainText` converts the given model to Protobuf format.
 */
function toPlainText(text: PlainTextInternal): PbJSONElement {
  const pbText = new PbJSONElement.Text();
  pbText.setNodesList(toTextNodes(text.getRGATreeSplit()));
  pbText.setCreatedAt(toTimeTicket(text.getCreatedAt()));
  pbText.setMovedAt(toTimeTicket(text.getMovedAt()));
  pbText.setRemovedAt(toTimeTicket(text.getRemovedAt()));

  const pbJSONElement = new PbJSONElement();
  pbJSONElement.setText(pbText);
  return pbJSONElement;
}

/**
 * `toCounter` converts the given model to Protobuf format.
 */
function toCounter(counter: CounterInternal): PbJSONElement {
  const pbJSONCounter = new PbJSONElement.Counter();
  pbJSONCounter.setType(toCounterType(counter.getType()));
  pbJSONCounter.setValue(counter.toBytes());
  pbJSONCounter.setCreatedAt(toTimeTicket(counter.getCreatedAt()));
  pbJSONCounter.setMovedAt(toTimeTicket(counter.getMovedAt()));
  pbJSONCounter.setRemovedAt(toTimeTicket(counter.getRemovedAt()));

  const pbJSONElement = new PbJSONElement();
  pbJSONElement.setCounter(pbJSONCounter);
  return pbJSONElement;
}

/**
 * `toJSONElement` converts the given model to Protobuf format.
 */
function toJSONElement(jsonElement: JSONElement): PbJSONElement {
  if (jsonElement instanceof ObjectInternal) {
    return toJSONObject(jsonElement);
  } else if (jsonElement instanceof ArrayInternal) {
    return toJSONArray(jsonElement);
  } else if (jsonElement instanceof JSONPrimitive) {
    return toJSONPrimitive(jsonElement);
  } else if (jsonElement instanceof PlainTextInternal) {
    return toPlainText(jsonElement);
  } else if (jsonElement instanceof CounterInternal) {
    return toCounter(jsonElement);
  } else {
    throw new YorkieError(
      Code.Unimplemented,
      `unimplemented element: ${jsonElement}`,
    );
  }
}

/**
 * `toChangePack` converts the given model to Protobuf format.
 */
function toChangePack(pack: ChangePack): PbChangePack {
  const pbChangePack = new PbChangePack();
  pbChangePack.setDocumentKey(pack.getDocumentKey());
  pbChangePack.setCheckpoint(toCheckpoint(pack.getCheckpoint()));
  pbChangePack.setChangesList(toChanges(pack.getChanges()));
  pbChangePack.setSnapshot(pack.getSnapshot()!);
  pbChangePack.setMinSyncedTicket(toTimeTicket(pack.getMinSyncedTicket()));
  return pbChangePack;
}

/**
 * `fromChangeID` converts the given Protobuf format to model format.
 */
function fromChangeID(pbChangeID: PbChangeID): ChangeID {
  return ChangeID.of(
    pbChangeID.getClientSeq(),
    Long.fromString(pbChangeID.getLamport(), true),
    toHexString(pbChangeID.getActorId_asU8()),
  );
}

/**
 * `fromTimeTicket` converts the given Protobuf format to model format.
 */
function fromTimeTicket(pbTimeTicket?: PbTimeTicket): TimeTicket | undefined {
  if (!pbTimeTicket) {
    return;
  }

  return TimeTicket.of(
    Long.fromString(pbTimeTicket.getLamport(), true),
    pbTimeTicket.getDelimiter(),
    toHexString(pbTimeTicket.getActorId_asU8()),
  );
}

/**
 * `fromValueType` converts the given Protobuf format to model format.
 */
function fromValueType(pbValueType: PbValueType): PrimitiveType {
  switch (pbValueType) {
    case PbValueType.NULL:
      return PrimitiveType.Null;
    case PbValueType.BOOLEAN:
      return PrimitiveType.Boolean;
    case PbValueType.INTEGER:
      return PrimitiveType.Integer;
    case PbValueType.LONG:
      return PrimitiveType.Long;
    case PbValueType.DOUBLE:
      return PrimitiveType.Double;
    case PbValueType.STRING:
      return PrimitiveType.String;
    case PbValueType.BYTES:
      return PrimitiveType.Bytes;
    case PbValueType.DATE:
      return PrimitiveType.Date;
  }
  throw new YorkieError(
    Code.Unimplemented,
    `unimplemented value type: ${pbValueType}`,
  );
}

/**
 * `fromCounterType` converts the given Protobuf format to model format.
 */
function fromCounterType(pbValueType: PbValueType): CounterType {
  switch (pbValueType) {
    case PbValueType.INTEGER_CNT:
      return CounterType.IntegerCnt;
    case PbValueType.LONG_CNT:
      return CounterType.LongCnt;
    case PbValueType.DOUBLE_CNT:
      return CounterType.DoubleCnt;
  }
  throw new YorkieError(
    Code.Unimplemented,
    `unimplemented value type: ${pbValueType}`,
  );
}

/**
 * `fromJSONElementSimple` converts the given Protobuf format to model format.
 */
function fromJSONElementSimple(
  pbJSONElement: PbJSONElementSimple,
): JSONElement {
  switch (pbJSONElement.getType()) {
    case PbValueType.JSON_OBJECT:
      return ObjectInternal.create(
        fromTimeTicket(pbJSONElement.getCreatedAt())!,
      );
    case PbValueType.JSON_ARRAY:
      return ArrayInternal.create(
        fromTimeTicket(pbJSONElement.getCreatedAt())!,
      );
    case PbValueType.TEXT:
      return PlainTextInternal.create(
        RGATreeSplit.create(),
        fromTimeTicket(pbJSONElement.getCreatedAt())!,
      );
    case PbValueType.RICH_TEXT:
      return RichTextInternal.create(
        RGATreeSplit.create(),
        fromTimeTicket(pbJSONElement.getCreatedAt())!,
      );
    case PbValueType.NULL:
    case PbValueType.BOOLEAN:
    case PbValueType.INTEGER:
    case PbValueType.LONG:
    case PbValueType.DOUBLE:
    case PbValueType.STRING:
    case PbValueType.BYTES:
    case PbValueType.DATE:
      return JSONPrimitive.of(
        JSONPrimitive.valueFromBytes(
          fromValueType(pbJSONElement.getType()),
          pbJSONElement.getValue_asU8(),
        ),
        fromTimeTicket(pbJSONElement.getCreatedAt())!,
      );
    case PbValueType.INTEGER_CNT:
    case PbValueType.DOUBLE_CNT:
    case PbValueType.LONG_CNT:
      return CounterInternal.of(
        CounterInternal.valueFromBytes(
          fromCounterType(pbJSONElement.getType()),
          pbJSONElement.getValue_asU8(),
        ),
        fromTimeTicket(pbJSONElement.getCreatedAt())!,
      );
  }

  throw new YorkieError(
    Code.Unimplemented,
    `unimplemented element: ${pbJSONElement}`,
  );
}

/**
 * `fromTextNodePos` converts the given Protobuf format to model format.
 */
function fromTextNodePos(pbTextNodePos: PbTextNodePos): RGATreeSplitNodePos {
  return RGATreeSplitNodePos.of(
    RGATreeSplitNodeID.of(
      fromTimeTicket(pbTextNodePos.getCreatedAt())!,
      pbTextNodePos.getOffset(),
    ),
    pbTextNodePos.getRelativeOffset(),
  );
}

/**
 * `fromTextNodeID` converts the given Protobuf format to model format.
 */
function fromTextNodeID(pbTextNodeID: PbTextNodeID): RGATreeSplitNodeID {
  return RGATreeSplitNodeID.of(
    fromTimeTicket(pbTextNodeID.getCreatedAt())!,
    pbTextNodeID.getOffset(),
  );
}

/**
 * `fromTextNode` converts the given Protobuf format to model format.
 */
function fromTextNode(pbTextNode: PbTextNode): RGATreeSplitNode<string> {
  const textNode = RGATreeSplitNode.create(
    fromTextNodeID(pbTextNode.getId()!),
    pbTextNode.getValue(),
  );
  textNode.remove(fromTimeTicket(pbTextNode.getRemovedAt()));
  return textNode;
}

/**
 * `fromRichTextNode` converts the given Protobuf format to model format.
 */
function fromRichTextNode(
  pbTextNode: PbRichTextNode,
): RGATreeSplitNode<RichTextValue> {
  const textNode = RGATreeSplitNode.create(
    fromTextNodeID(pbTextNode.getId()!),
    RichTextValue.create(pbTextNode.getValue()),
  );
  textNode.remove(fromTimeTicket(pbTextNode.getRemovedAt()));
  return textNode;
}

/**
 * `fromOperations` converts the given Protobuf format to model format.
 */
function fromOperations(pbOperations: Array<PbOperation>): Array<Operation> {
  const operations = [];

  for (const pbOperation of pbOperations) {
    let operation: Operation;
    if (pbOperation.hasSet()) {
      const pbSetOperation = pbOperation.getSet();
      operation = SetOperation.create(
        pbSetOperation!.getKey(),
        fromJSONElementSimple(pbSetOperation!.getValue()!),
        fromTimeTicket(pbSetOperation!.getParentCreatedAt())!,
        fromTimeTicket(pbSetOperation!.getExecutedAt())!,
      );
    } else if (pbOperation.hasAdd()) {
      const pbAddOperation = pbOperation.getAdd();
      operation = AddOperation.create(
        fromTimeTicket(pbAddOperation!.getParentCreatedAt())!,
        fromTimeTicket(pbAddOperation!.getPrevCreatedAt())!,
        fromJSONElementSimple(pbAddOperation!.getValue()!),
        fromTimeTicket(pbAddOperation!.getExecutedAt())!,
      );
    } else if (pbOperation.hasMove()) {
      const pbMoveOperation = pbOperation.getMove();
      operation = MoveOperation.create(
        fromTimeTicket(pbMoveOperation!.getParentCreatedAt())!,
        fromTimeTicket(pbMoveOperation!.getPrevCreatedAt())!,
        fromTimeTicket(pbMoveOperation!.getCreatedAt())!,
        fromTimeTicket(pbMoveOperation!.getExecutedAt())!,
      );
    } else if (pbOperation.hasRemove()) {
      const pbRemoveOperation = pbOperation.getRemove();
      operation = RemoveOperation.create(
        fromTimeTicket(pbRemoveOperation!.getParentCreatedAt())!,
        fromTimeTicket(pbRemoveOperation!.getCreatedAt())!,
        fromTimeTicket(pbRemoveOperation!.getExecutedAt())!,
      );
    } else if (pbOperation.hasEdit()) {
      const pbEditOperation = pbOperation.getEdit();
      const createdAtMapByActor = new Map();
      pbEditOperation!.getCreatedAtMapByActorMap().forEach((value, key) => {
        createdAtMapByActor.set(key, fromTimeTicket(value));
      });
      operation = EditOperation.create(
        fromTimeTicket(pbEditOperation!.getParentCreatedAt())!,
        fromTextNodePos(pbEditOperation!.getFrom()!),
        fromTextNodePos(pbEditOperation!.getTo()!),
        createdAtMapByActor,
        pbEditOperation!.getContent(),
        fromTimeTicket(pbEditOperation!.getExecutedAt())!,
      );
    } else if (pbOperation.hasSelect()) {
      const pbSelectOperation = pbOperation.getSelect();
      operation = SelectOperation.create(
        fromTimeTicket(pbSelectOperation!.getParentCreatedAt())!,
        fromTextNodePos(pbSelectOperation!.getFrom()!),
        fromTextNodePos(pbSelectOperation!.getTo()!),
        fromTimeTicket(pbSelectOperation!.getExecutedAt())!,
      );
    } else if (pbOperation.hasRichEdit()) {
      const pbEditOperation = pbOperation.getRichEdit();
      const createdAtMapByActor = new Map();
      pbEditOperation!.getCreatedAtMapByActorMap().forEach((value, key) => {
        createdAtMapByActor.set(key, fromTimeTicket(value));
      });
      const attributes = new Map();
      pbEditOperation!.getAttributesMap().forEach((value, key) => {
        attributes.set(key, value);
      });
      operation = RichEditOperation.create(
        fromTimeTicket(pbEditOperation!.getParentCreatedAt())!,
        fromTextNodePos(pbEditOperation!.getFrom()!),
        fromTextNodePos(pbEditOperation!.getTo()!),
        createdAtMapByActor,
        pbEditOperation!.getContent(),
        attributes,
        fromTimeTicket(pbEditOperation!.getExecutedAt())!,
      );
    } else if (pbOperation.hasStyle()) {
      const pbStyleOperation = pbOperation.getStyle();
      const attributes = new Map();
      pbStyleOperation!.getAttributesMap().forEach((value, key) => {
        attributes.set(key, value);
      });
      operation = StyleOperation.create(
        fromTimeTicket(pbStyleOperation!.getParentCreatedAt())!,
        fromTextNodePos(pbStyleOperation!.getFrom()!),
        fromTextNodePos(pbStyleOperation!.getTo()!),
        attributes,
        fromTimeTicket(pbStyleOperation!.getExecutedAt())!,
      );
    } else if (pbOperation.hasIncrease()) {
      const pbIncreaseOperation = pbOperation.getIncrease();
      operation = IncreaseOperation.create(
        fromTimeTicket(pbIncreaseOperation!.getParentCreatedAt())!,
        fromJSONElementSimple(pbIncreaseOperation!.getValue()!),
        fromTimeTicket(pbIncreaseOperation!.getExecutedAt())!,
      );
    } else {
      throw new YorkieError(Code.Unimplemented, `unimplemented operation`);
    }

    operations.push(operation);
  }

  return operations;
}

/**
 * `fromChanges` converts the given Protobuf format to model format.
 */
function fromChanges(pbChanges: Array<PbChange>): Array<Change> {
  const changes = [];

  for (const pbChange of pbChanges) {
    changes.push(
      Change.create(
        fromChangeID(pbChange.getId()!),
        fromOperations(pbChange.getOperationsList()),
        pbChange.getMessage(),
      ),
    );
  }

  return changes;
}

/**
 * `fromCheckpoint` converts the given Protobuf format to model format.
 */
function fromCheckpoint(pbCheckpoint: PbCheckpoint): Checkpoint {
  return Checkpoint.of(
    Long.fromString(pbCheckpoint.getServerSeq(), true),
    pbCheckpoint.getClientSeq(),
  );
}

/**
 * `fromChangePack` converts the given Protobuf format to model format.
 */
function fromChangePack(pbPack: PbChangePack): ChangePack {
  return ChangePack.create(
    pbPack.getDocumentKey()!,
    fromCheckpoint(pbPack.getCheckpoint()!),
    fromChanges(pbPack.getChangesList()),
    pbPack.getSnapshot_asU8(),
    fromTimeTicket(pbPack.getMinSyncedTicket()),
  );
}

/**
 * `fromJSONObject` converts the given Protobuf format to model format.
 */
function fromJSONObject(pbObject: PbJSONElement.JSONObject): ObjectInternal {
  const rht = new RHTPQMap();
  for (const pbRHTNode of pbObject.getNodesList()) {
    // eslint-disable-next-line
    rht.set(pbRHTNode.getKey(), fromJSONElement(pbRHTNode.getElement()!));
  }

  const obj = new ObjectInternal(fromTimeTicket(pbObject.getCreatedAt())!, rht);
  obj.setMovedAt(fromTimeTicket(pbObject.getMovedAt()));
  obj.setRemovedAt(fromTimeTicket(pbObject.getRemovedAt()));
  return obj;
}

/**
 * `fromJSONArray` converts the given Protobuf format to model format.
 */
function fromJSONArray(pbArray: PbJSONElement.JSONArray): ArrayInternal {
  const rgaTreeList = new RGATreeList();
  for (const pbRGANode of pbArray.getNodesList()) {
    // eslint-disable-next-line
    rgaTreeList.insert(fromJSONElement(pbRGANode.getElement()!));
  }

  const arr = new ArrayInternal(
    fromTimeTicket(pbArray.getCreatedAt())!,
    rgaTreeList,
  );
  arr.setMovedAt(fromTimeTicket(pbArray.getMovedAt()));
  arr.setRemovedAt(fromTimeTicket(pbArray.getRemovedAt()));
  return arr;
}

/**
 * `fromJSONPrimitive` converts the given Protobuf format to model format.
 */
function fromJSONPrimitive(
  pbPrimitive: PbJSONElement.Primitive,
): JSONPrimitive {
  const primitive = JSONPrimitive.of(
    JSONPrimitive.valueFromBytes(
      fromValueType(pbPrimitive.getType()),
      pbPrimitive.getValue_asU8(),
    ),
    fromTimeTicket(pbPrimitive.getCreatedAt())!,
  );
  primitive.setMovedAt(fromTimeTicket(pbPrimitive.getMovedAt()));
  primitive.setRemovedAt(fromTimeTicket(pbPrimitive.getRemovedAt()));
  return primitive;
}

/**
 * `fromJSONText` converts the given Protobuf format to model format.
 */
function fromJSONText(pbText: PbJSONElement.Text): PlainTextInternal {
  const rgaTreeSplit = new RGATreeSplit<string>();

  let prev = rgaTreeSplit.getHead();
  for (const pbNode of pbText.getNodesList()) {
    const current = rgaTreeSplit.insertAfter(prev, fromTextNode(pbNode));
    if (pbNode.hasInsPrevId()) {
      current.setInsPrev(
        rgaTreeSplit.findNode(fromTextNodeID(pbNode.getInsPrevId()!)),
      );
    }
    prev = current;
  }

  const text = PlainTextInternal.create(
    rgaTreeSplit,
    fromTimeTicket(pbText.getCreatedAt())!,
  );
  text.setMovedAt(fromTimeTicket(pbText.getMovedAt()));
  text.setRemovedAt(fromTimeTicket(pbText.getRemovedAt()));
  return text;
}

/**
 * `fromJSONRichText` converts the given Protobuf format to model format.
 */
function fromJSONRichText(pbText: PbJSONElement.RichText): RichTextInternal {
  const rgaTreeSplit = new RGATreeSplit<RichTextValue>();

  let prev = rgaTreeSplit.getHead();
  for (const pbNode of pbText.getNodesList()) {
    const current = rgaTreeSplit.insertAfter(prev, fromRichTextNode(pbNode));
    if (pbNode.hasInsPrevId()) {
      current.setInsPrev(
        rgaTreeSplit.findNode(fromTextNodeID(pbNode.getInsPrevId()!)),
      );
    }
    prev = current;
  }

  const text = RichTextInternal.create(
    rgaTreeSplit,
    fromTimeTicket(pbText.getCreatedAt())!,
  );
  text.setMovedAt(fromTimeTicket(pbText.getMovedAt()));
  text.setRemovedAt(fromTimeTicket(pbText.getRemovedAt()));
  return text;
}

/**
 * `fromCounter` converts the given Protobuf format to model format.
 */
function fromCounter(pbCounter: PbJSONElement.Counter): CounterInternal {
  const counter = CounterInternal.of(
    CounterInternal.valueFromBytes(
      fromCounterType(pbCounter.getType()),
      pbCounter.getValue_asU8(),
    ),
    fromTimeTicket(pbCounter.getCreatedAt())!,
  );
  counter.setMovedAt(fromTimeTicket(pbCounter.getMovedAt()));
  counter.setRemovedAt(fromTimeTicket(pbCounter.getRemovedAt()));
  return counter;
}

/**
 * `fromJSONElement` converts the given Protobuf format to model format.
 */
function fromJSONElement(pbJSONElement: PbJSONElement): JSONElement {
  if (pbJSONElement.hasJsonObject()) {
    return fromJSONObject(pbJSONElement.getJsonObject()!);
  } else if (pbJSONElement.hasJsonArray()) {
    return fromJSONArray(pbJSONElement.getJsonArray()!);
  } else if (pbJSONElement.hasPrimitive()) {
    return fromJSONPrimitive(pbJSONElement.getPrimitive()!);
  } else if (pbJSONElement.hasText()) {
    return fromJSONText(pbJSONElement.getText()!);
  } else if (pbJSONElement.hasRichText()) {
    return fromJSONRichText(pbJSONElement.getRichText()!);
  } else if (pbJSONElement.hasCounter()) {
    return fromCounter(pbJSONElement.getCounter()!);
  } else {
    throw new YorkieError(
      Code.Unimplemented,
      `unimplemented element: ${pbJSONElement}`,
    );
  }
}

/**
 * `bytesToObject` creates an JSONObject from the given byte array.
 */
function bytesToObject(bytes?: Uint8Array): ObjectInternal {
  if (!bytes) {
    return ObjectInternal.create(InitialTimeTicket);
  }

  const pbJSONElement = PbJSONElement.deserializeBinary(bytes);
  return fromJSONObject(pbJSONElement.getJsonObject()!);
}

/**
 * `objectToBytes` converts the given JSONObject to byte array.
 */
function objectToBytes(obj: ObjectInternal): Uint8Array {
  return toJSONElement(obj).serializeBinary();
}

/**
 * `toHexString` converts the given byte array to hex string.
 */
function toHexString(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

/**
 * `toUnit8Array` converts the given hex string to byte array.
 */
function toUint8Array(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

export const converter = {
  fromPresence,
  toClient,
  toChangePack,
  fromChangePack,
  objectToBytes,
  bytesToObject,
  toHexString,
  toUint8Array,
};
