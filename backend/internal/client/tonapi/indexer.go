package tonapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
)

// Indexer support structures

type EventHistory struct {
	Events []AccountEvent `json:"events"`
	NextFrom int64 `json:"next_from"`
}

type AccountEvent struct {
	EventID   string   `json:"event_id"`
	Timestamp int64    `json:"timestamp"`
	Actions   []Action `json:"actions"`
	IsScam    bool     `json:"is_scam"`
	LT        int64    `json:"lt"`
}

type Action struct {
	Type            string           `json:"type"`
	Status          string           `json:"status"`
	NftItemTransfer *NftItemTransfer `json:"NftItemTransfer,omitempty"`
	TonTransfer     *TonTransfer     `json:"TonTransfer,omitempty"`
	SmartContractExec *SmartContractExec `json:"SmartContractExec,omitempty"`
	BaseTransactions []string        `json:"base_transactions"`
}

type NftItemTransfer struct {
	Sender    AccountAddress `json:"sender"`
	Recipient AccountAddress `json:"recipient"`
	NFT       string         `json:"nft"`
	Comment   string         `json:"comment"`
}

type TonTransfer struct {
	Sender    AccountAddress `json:"sender"`
	Recipient AccountAddress `json:"recipient"`
	Amount    int64          `json:"amount"`
	Comment   string         `json:"comment"`
}

type SmartContractExec struct {
	Executor AccountAddress `json:"executor"`
	Contract AccountAddress `json:"contract"`
	TonAttached int64       `json:"ton_attached"`
	Operation string        `json:"operation"`
}

type AccountAddress struct {
	Address string `json:"address"`
	Name    string `json:"name"`
	IsWallet bool  `json:"is_wallet"`
}

type Trace struct {
	ID            string        `json:"id"`
	Transaction   Transaction   `json:"transaction"`
	Interfaces    []string      `json:"interfaces"`
	Children      []Trace       `json:"children"`
}

type Transaction struct {
	Hash       string `json:"hash"`
	LT         int64  `json:"lt"`
	Account    AccountAddress `json:"account"`
	Success    bool   `json:"success"`
	InMsg      *Message `json:"in_msg"`
	OutMsgs    []Message `json:"out_msgs"`
}

type Message struct {
	CreatedLT   int64  `json:"created_lt"`
	Value       int64  `json:"value"`
	OpCode      string `json:"op_code,omitempty"`
	DecodedOpName string `json:"decoded_op_name,omitempty"`
}

// FetchCollectionItems fetches paginated NFTs in a collection
func (c *Client) FetchCollectionItems(ctx context.Context, collection string, limit int, offset int) (*NFTItems, error) {
	resp, err := c.GetCollectionItems(ctx, collection, limit, offset)
	if err != nil {
		return nil, err
	}
	return &NFTItems{Items: resp.Items}, nil
}

// FetchNFTHistory fetches the event history for an NFT address
func (c *Client) FetchNFTHistory(ctx context.Context, nftAddr string, limit int) (*EventHistory, error) {
	url := fmt.Sprintf("%s/nfts/%s/history?limit=%d", c.BaseURL, nftAddr, limit)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("tonapi history error: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var data EventHistory
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}
	return &data, nil
}

// FetchTrace fetches a full trace recursively
func (c *Client) FetchTrace(ctx context.Context, traceID string) (*Trace, error) {
	url := fmt.Sprintf("%s/traces/%s", c.BaseURL, traceID)
	resp, err := c.doRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("tonapi trace error: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var data Trace
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}
	return &data, nil
}
