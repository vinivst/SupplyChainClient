import React, { Component } from 'react';
import ItemManagerContract from './contracts/ItemManager.json';
import ItemContract from './contracts/Item.json';
import getWeb3 from './getWeb3';
import {
  Container,
  Row,
  Col,
  InputGroup,
  InputGroupAddon,
  Input,
  Button,
  Table,
} from 'reactstrap';

import './App.css';

class App extends Component {
  state = { cost: 0, itemName: 'exampleItem1', loaded: false, items: [] };

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance.
      this.web3 = await getWeb3();

      // Use web3 to get the user's accounts.
      this.accounts = await this.web3.eth.getAccounts();

      // Get the contract instance.
      const networkId = await this.web3.eth.net.getId();

      this.itemManager = new this.web3.eth.Contract(
        ItemManagerContract.abi,
        ItemManagerContract.networks[networkId] &&
          ItemManagerContract.networks[networkId].address
      );
      this.item = new this.web3.eth.Contract(
        ItemContract.abi,
        ItemContract.networks[networkId] &&
          ItemContract.networks[networkId].address
      );

      let index = await this.itemManager.methods
        .index()
        .call({ from: this.accounts[0] });

      let items = this.state.items;

      for (let i = 0; i < index; i++) {
        let item = await this.itemManager.methods
          .items(i)
          .call({ from: this.accounts[0] });
        items.push(item);
      }

      // Set web3, accounts, and contract to the state, and then proceed with an
      // example of interacting with the contract's methods.
      this.listenToPaymentEvent();
      this.listenToCreateEvent();
      this.listenToDeliveryEvent();
      this.setState({ loaded: true, items });
    } catch (error) {
      // Catch any errors for any of the above operations.
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`
      );
      console.error(error);
    }
  };

  handleSubmit = async () => {
    let { cost, itemName } = this.state;
    console.log(itemName, cost, this.itemManager);
    let result = await this.itemManager.methods
      .createItem(itemName, cost)
      .send({ from: this.accounts[0] });
    console.log(result);
    alert(
      'Send ' +
        cost +
        ' Wei to ' +
        result.events.SupplyChainStep.returnValues._address
    );
  };

  handleInputChange = (event) => {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    this.setState({
      [name]: value,
    });
  };

  listenToCreateEvent = () => {
    let self = this;
    let items = this.state.items;
    this.itemManager.events.SupplyChainStep().on('data', async (evt) => {
      if (evt.returnValues._step === '0') {
        let item = await self.itemManager.methods
          .items(evt.returnValues._itemIndex)
          .call();
        console.log(item);
        items.push(item);
        alert('Item ' + item._identifier + ' created!');
      }
      //console.log(evt);
      //console.log(items);
      this.setState({ items });
      //console.log(this.state.items);
    });

    /* let item = {
      id: index,
      name: itemName,
      cost: cost,
      address: result.events.SupplyChainStep.returnValues._address,
      status: result.events.SupplyChainStep.returnValues._step,
    };
    items.push(item);
    this.setState({ items });
    console.log(items); */
  };

  listenToPaymentEvent = () => {
    let self = this;
    this.itemManager.events.SupplyChainStep().on('data', async (evt) => {
      if (evt.returnValues._step === '1') {
        let item = await self.itemManager.methods
          .items(evt.returnValues._itemIndex)
          .call();
        console.log(item);
        alert('Item ' + item._identifier + ' was paid, deliver it now!');
        let items = this.state.items;
        items[evt.returnValues._itemIndex]._step = '1';
        this.setState({ items });
      }
      console.log(evt);
    });
  };

  listenToDeliveryEvent = () => {
    let self = this;
    this.itemManager.events.SupplyChainStep().on('data', async (evt) => {
      if (evt.returnValues._step === '2') {
        let item = await self.itemManager.methods
          .items(evt.returnValues._itemIndex)
          .call();
        console.log(item);
        alert('Item ' + item._identifier + ' was sent!');
        let items = this.state.items;
        items[evt.returnValues._itemIndex]._step = '2';
        this.setState({ items });
      }
      console.log(evt);
    });
  };

  render() {
    if (!this.state.loaded) {
      return (
        <div>
          Loading Web3, accounts, and contract...You must have Metamask and
          switch to Rinkeby network.
        </div>
      );
    }
    const pay = async (item) => {
      await this.web3.eth.sendTransaction({
        from: this.accounts[0],
        to: item._item,
        value: item._cost,
      });
    };
    const deliver = async (item) => {
      await this.itemManager.methods
        .triggerDelivery(item._id)
        .send({ from: this.accounts[0] });
    };
    return (
      <Container>
        <div className="App">
          <Row>
            <Col className="title">
              <h1>Eccommerce Inventory - Supply Chain</h1>
            </Col>
          </Row>
          <Row>
            <Col className="title">
              <br />
              <h2>Items</h2>
            </Col>
          </Row>
          <Row>
            <Col>
              <Table striped>
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Name</th>
                    <th>Cost</th>
                    <th>Address</th>
                    <th>Status</th>
                    <th>Deliver</th>
                  </tr>
                </thead>
                <tbody>
                  {this.state.items.map((item) => (
                    <tr key={item._id}>
                      <td>{item._id}</td>
                      <td>{item._identifier}</td>
                      <td>{item._cost}</td>
                      <td>{item._item}</td>
                      <td>
                        {item._step} {'    '}
                        <Button
                          color="primary"
                          disabled={item._step !== '0'}
                          onClick={() => {
                            pay(item);
                          }}
                        >
                          Pay
                        </Button>
                      </td>
                      <td>
                        <Button
                          color="secondary"
                          disabled={item._step !== '1'}
                          onClick={() => {
                            deliver(item);
                          }}
                        >
                          Send
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Col>
          </Row>
          <Row>
            <Col className="title">
              <br />
              <h2>Add Element</h2>
              <br />
            </Col>
          </Row>
          <Row>
            <Col>
              <InputGroup>
                <InputGroupAddon addonType="prepend" className="title">
                  Cost:
                </InputGroupAddon>
                <Input
                  type="text"
                  name="cost"
                  value={this.state.cost}
                  onChange={this.handleInputChange}
                />
                <InputGroupAddon>Item Name:</InputGroupAddon>
                <Input
                  type="text"
                  name="itemName"
                  value={this.state.itemName}
                  onChange={this.handleInputChange}
                />
                <InputGroupAddon addonType="append">
                  <Button onClick={this.handleSubmit} color="secondary">
                    Create new Item
                  </Button>
                </InputGroupAddon>
              </InputGroup>
              <br />
            </Col>
          </Row>
        </div>
      </Container>
    );
  }
}

export default App;
